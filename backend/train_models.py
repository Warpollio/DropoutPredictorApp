import argparse
import json
import warnings
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score, f1_score
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sqlalchemy import create_engine, text

warnings.filterwarnings('ignore')

DB_URL = "postgresql://app_user:password@127.0.0.1:5433/dropout_predictor"
TEST_SIZE = 0.3
RANDOM_STATE = 42


FEATURE_COLS = [
    'first_try_success_rate',
    'avg_attempts_per_step',
    'std_attempts_per_step',
    'pct_steps_with_post_success',
    'avg_errors_before_success',
    'steps_completed',
    'max_step_reached',
    'attempts_trend_slope',
    'is_sequence_escalating',
    'comments_count',   
    'retry_intensity'    
]


def load_features(cf_id: int, progress_threshold: float = 80.0, engine=None) -> tuple:
    query = text("""
        SELECT 
            udf.user_id,
            udf.cf_id,
            udf.last_activity_utc,
            udf.steps_completed,
            udf.first_try_success_rate,
            udf.avg_attempts_per_step,
            udf.std_attempts_per_step,
            udf.pct_steps_with_post_success,
            udf.avg_errors_before_success,
            udf.max_step_reached,
            udf.attempts_trend_slope,
            udf.is_sequence_escalating::int as is_sequence_escalating,
            -- Извлекаем из JSONB
            (udf.global_attempt_pattern ->> 'comments_count')::float as comments_count,
            (udf.global_attempt_pattern ->> 'retry_intensity')::float as retry_intensity,
            -- Таргет из таблицы прогресса
            ucp.progress_percent
        FROM user_dropout_feature udf
        JOIN course_feature cf ON udf.cf_id = cf.cf_id
        JOIN user_course_progress ucp 
            ON udf.user_id = ucp.user_id 
            AND cf.course_id = ucp.course_id
        WHERE udf.cf_id = :cf_id
    """)
    
    df = pd.read_sql(query, engine, params={"cf_id": cf_id})
    if df.empty:
        raise ValueError(f"Не найдено фич для cf_id={cf_id}")
    
    print(f"Загружено {len(df)} пользователей для cf_id={cf_id}")
    
    df['is_dropout'] = (df['progress_percent'] <= progress_threshold).astype(int)
    
    feature_cols = [c for c in FEATURE_COLS if c in df.columns]
    X = df[feature_cols].copy()

    X['user_id'] = df['user_id'].values

    for col in feature_cols:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median())
            
    y = df['is_dropout']
    
    print(f"Распределение таргета (threshold={progress_threshold}%): "
          f"дропаут={y.sum()} ({y.mean()*100:.1f}%), успешные={len(y)-y.sum()}")
    
    meta = df[['user_id', 'cf_id', 'progress_percent', 'is_dropout', 
               'last_activity_utc', 'steps_completed']].copy()
    
    return X, y, meta

def train_and_evaluate(X_train, X_test, y_train, y_test, model_name: str, model):
    
    print(f"Обучение {model_name}...")
    
    if model_name == 'Logistic Regression':
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
    else:
        X_train_scaled = X_train
        X_test_scaled = X_test
    
    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]
    
    metrics = {
        'model': model_name,
        'roc_auc': roc_auc_score(y_test, y_proba),
        'precision': precision_score(y_test, y_pred, zero_division=0),
        'recall': recall_score(y_test, y_pred, zero_division=0),
        'f1': f1_score(y_test, y_pred, zero_division=0),
        'train_size': len(X_train),
        'test_size': len(X_test),
    }
    
    if hasattr(model, 'feature_importances_'):
        metrics['feature_importance'] = dict(
            sorted(zip(X_train.columns, model.feature_importances_), key=lambda x: x[1], reverse=True)
        )
    if model_name == 'Logistic Regression':
        metrics['coefficients'] = dict(zip(X_train.columns, model.coef_[0]))
        
    print(f"   ✅ {model_name}: ROC-AUC={metrics['roc_auc']:.3f}, F1={metrics['f1']:.3f}")
    return metrics

import os
import joblib


def compare_models(X, y, output_path: str = None, cf_id=None, threshold=None, save_dir='models'):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}")
    
    models = {
        'Logistic Regression': LogisticRegression(max_iter=1000, class_weight='balanced', random_state=RANDOM_STATE),
        'Random Forest': RandomForestClassifier(n_estimators=100, max_depth=10, class_weight='balanced', random_state=RANDOM_STATE, n_jobs=-1),
        'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=RANDOM_STATE),
    }
    
    MODEL_IDS = {
        'Logistic Regression': 'logistic',
        'Random Forest': 'random_forest',
        'Gradient Boosting': 'gradient_boosting'
    }

    results = []
    for name, model in models.items():
        metrics = train_and_evaluate(X_train, X_test, y_train, y_test, name, model)
        results.append(metrics)
        
        if cf_id is not None and save_dir:
            os.makedirs(save_dir, exist_ok=True)
            model_id = MODEL_IDS[name]
            joblib.dump({
                'model': model,
                'feature_cols': list(X.columns),
                'threshold': threshold,
                'metrics': metrics
            }, f"{save_dir}/cf_{cf_id}_{model_id}_model.pkl")
        
    results_sorted = sorted(results, key=lambda x: x['roc_auc'], reverse=True)
    
    print("\n" + "="*80)
    print("СРАВНЕНИЕ МОДЕЛЕЙ")
    print("="*80)
    print(f"{'Модель':<25} {'ROC-AUC':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    print("-"*80)
    for r in results_sorted:
        print(f"{r['model']:<25} {r['roc_auc']:>10.3f} {r['precision']:>10.3f} {r['recall']:>10.3f} {r['f1']:>10.3f}")
    print("="*80)
    
    output = {
        'timestamp': datetime.utcnow().isoformat(),
        'config': {'test_size': TEST_SIZE, 'threshold': None, 'features_used': list(X.columns)},
        'results': results_sorted,
        'best_model': results_sorted[0]['model'],
        'best_roc_auc': results_sorted[0]['roc_auc']
    }
    
    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2, default=str)
        print(f"💾 Результаты сохранены в {output_path}")
        
    return output