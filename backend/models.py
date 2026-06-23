from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, Text, func, String, JSON, Text
)

from sqlalchemy.orm import (
    Mapped, mapped_column, relationship
)

from config import db

class ComputeTask(db.Model):
    __tablename__ = 'compute_tasks'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    message: Mapped[str] = mapped_column(String(255), default='')
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Course(db.Model):
    __tablename__ = 'course'

    course_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    discrimination: Mapped[float] = mapped_column(Float, default=0.5)

    modules: Mapped[List["Module"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )

    feature_sessions: Mapped[List["CourseFeature"]] = relationship(
        back_populates="course", foreign_keys="CourseFeature.course_id",
        cascade="all, delete-orphan", lazy="dynamic"
    )


class Module(db.Model):
    __tablename__ = 'module'
    __table_args__ = (Index('idx_module_course', 'course_id'),)

    module_id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey('course.course_id', ondelete='CASCADE'))
    position: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    discrimination: Mapped[float] = mapped_column(Float, default=0.5)

    course: Mapped["Course"] = relationship(back_populates="modules")
    lessons: Mapped[List["Lesson"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )


class Lesson(db.Model):
    __tablename__ = 'lesson'
    __table_args__ = (Index('idx_lesson_module', 'module_id'),)

    lesson_id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey('module.module_id', ondelete='CASCADE'))
    position: Mapped[int] = mapped_column(Integer, default=0)
    begin_date_utc: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_date_utc: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    soft_deadline_utc: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    hard_deadline_utc: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    grading_policy: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    module: Mapped["Module"] = relationship(back_populates="lessons")
    steps: Mapped[List["Step"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )


class Step(db.Model):
    __tablename__ = 'step'
    __table_args__ = (Index('idx_step_lesson', 'lesson_id'),)

    step_id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey('lesson.lesson_id', ondelete='CASCADE'))
    position: Mapped[int] = mapped_column(Integer, default=0)
    step_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    step_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.0)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    discrimination: Mapped[float] = mapped_column(Float, default=0.5)

    submissions_count: Mapped[int] = mapped_column(Integer, default=0)
    successful_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)


    lesson: Mapped["Lesson"] = relationship(back_populates="steps")
    submissions: Mapped[List["Submission"]] = relationship(
        back_populates="step", cascade="all, delete-orphan"
    )
    comments: Mapped[List["Comment"]] = relationship(
        back_populates="step", cascade="all, delete-orphan"
    )

    user_step_features: Mapped[List["UserStepFeature"]] = relationship(
        back_populates="step", foreign_keys="UserStepFeature.step_id",
        cascade="all, delete-orphan", lazy="dynamic"
    )


class Learner(db.Model):
    __tablename__ = 'learner'
    __table_args__ = (Index('idx_learner_joined', 'date_joined_utc'),) 

    user_id: Mapped[int] = mapped_column(primary_key=True)
    last_name: Mapped[str] = mapped_column(Text, nullable=False)
    first_name: Mapped[str] = mapped_column(Text, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_joined_utc: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    submissions: Mapped[List["Submission"]] = relationship(
        back_populates="learner", cascade="all, delete-orphan"
    )
    comments: Mapped[List["Comment"]] = relationship(
        back_populates="learner", cascade="all, delete-orphan"
    )

    step_features: Mapped[List["UserStepFeature"]] = relationship(
        back_populates="learner", foreign_keys="UserStepFeature.user_id",
        cascade="all, delete-orphan", lazy="dynamic"
    )
    dropout_features: Mapped[List["UserDropoutFeature"]] = relationship( 
        back_populates="learner", foreign_keys="UserDropoutFeature.user_id",
        cascade="all, delete-orphan", lazy="dynamic"
    )
    predictions: Mapped[List["DropoutPrediction"]] = relationship(
        back_populates="learner", foreign_keys="DropoutPrediction.user_id",
        cascade="all, delete-orphan", lazy="dynamic"
    )


class Submission(db.Model):
    __tablename__ = 'submission'
    __table_args__ = (
        Index('idx_submission_step', 'step_id'),
        Index('idx_submission_user', 'user_id'),
        Index('idx_submission_time', 'submission_time'),
        Index('idx_submission_time_us', 'submission_time', 'user_id', 'step_id'),
    )

    submission_id: Mapped[int] = mapped_column(primary_key=True)
    step_id: Mapped[int] = mapped_column(ForeignKey('step.step_id', ondelete='CASCADE'))
    user_id: Mapped[int] = mapped_column(ForeignKey('learner.user_id', ondelete='CASCADE'))
    attempt_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    submission_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dataset: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clue: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reply_clear: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    step: Mapped["Step"] = relationship(back_populates="submissions")
    learner: Mapped["Learner"] = relationship(back_populates="submissions")


class Comment(db.Model):
    __tablename__ = 'comment'
    __table_args__ = (
        Index('idx_comment_step', 'step_id'),
        Index('idx_comment_user', 'user_id'),
        Index('idx_comment_parent', 'parent_comment_id'),
    )

    comment_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('learner.user_id', ondelete='CASCADE'))
    step_id: Mapped[int] = mapped_column(ForeignKey('step.step_id', ondelete='CASCADE'))
    parent_comment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey('comment.comment_id', ondelete='CASCADE'), nullable=True
    )
    time_utc: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    learner: Mapped["Learner"] = relationship(back_populates="comments")
    step: Mapped["Step"] = relationship(back_populates="comments")
    
    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment",
        remote_side='Comment.comment_id',
        back_populates="replies",
        foreign_keys=[parent_comment_id]
    )
    replies: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys=[parent_comment_id]
    )


from sqlalchemy import JSON as JSONB


class CourseFeature(db.Model):
    __tablename__ = 'course_feature'
    __table_args__ = (
        Index('idx_cf_course_time', 'course_id', 'calculated_at'),
        Index('idx_cf_version', 'feature_version'),
    )

    cf_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey('course.course_id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(),
    )
    feature_version: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    prediction_cutoff_utc: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    # Relationships
    course: Mapped["Course"] = relationship(
        back_populates="feature_sessions", foreign_keys=[course_id]
    )
    user_step_features: Mapped[List["UserStepFeature"]] = relationship(
        back_populates="feature_session", cascade="all, delete-orphan", lazy="dynamic"
    )
    user_dropout_features: Mapped[List["UserDropoutFeature"]] = relationship(
        back_populates="feature_session", cascade="all, delete-orphan", lazy="dynamic"
    )


class UserStepFeature(db.Model):
    __tablename__ = 'user_step_feature'
    __table_args__ = (
        Index('idx_usf_cf', 'cf_id'),
        Index('idx_usf_user', 'user_id'),
        Index('idx_usf_step', 'step_id'),
        Index('idx_usf_unique', 'cf_id', 'user_id', 'step_id', unique=True),
    )


    cf_id: Mapped[int] = mapped_column(
        ForeignKey('course_feature.cf_id', ondelete='CASCADE'),
        primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey('learner.user_id', ondelete='CASCADE'),
        primary_key=True
    )
    step_id: Mapped[int] = mapped_column(
        ForeignKey('step.step_id', ondelete='CASCADE'),
        primary_key=True
    )


    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    first_try_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    errors_before_success: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    has_post_success_attempts: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    attempt_sequence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


    feature_session: Mapped["CourseFeature"] = relationship(
        back_populates="user_step_features", foreign_keys=[cf_id]
    )
    learner: Mapped["Learner"] = relationship(
        back_populates="step_features", foreign_keys=[user_id]
    )
    step: Mapped["Step"] = relationship(
        back_populates="user_step_features", foreign_keys=[step_id]
    )


class UserDropoutFeature(db.Model):
    __tablename__ = 'user_dropout_feature'
    __table_args__ = (
        Index('idx_udf_cf', 'cf_id'),
        Index('idx_udf_user', 'user_id'),

        Index('idx_udf_unique', 'cf_id', 'user_id', unique=True),
    )

    # PK: составной (сессия + пользователь)
    cf_id: Mapped[int] = mapped_column(
        ForeignKey('course_feature.cf_id', ondelete='CASCADE'),
        primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey('learner.user_id', ondelete='CASCADE'),
        primary_key=True
    )


    first_try_success_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_attempts_per_step: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    std_attempts_per_step: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_steps_with_post_success: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_errors_before_success: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    steps_completed: Mapped[int] = mapped_column(Integer, default=0)
    max_step_reached: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_activity_utc: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


    attempts_trend_slope: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_sequence_escalating: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)


    global_attempt_pattern: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)


    feature_session: Mapped["CourseFeature"] = relationship(
        back_populates="user_dropout_features", foreign_keys=[cf_id]
    )
    learner: Mapped["Learner"] = relationship(
        back_populates="dropout_features", foreign_keys=[user_id]
    )


class DropoutPrediction(db.Model):
    __tablename__ = 'dropout_prediction'
    __table_args__ = (
        Index('idx_dp_user_time', 'user_id', 'prediction_time'),
        Index('idx_dp_model', 'model_version'),
    )

    prediction_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey('learner.user_id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )


    dropout_probability: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_label: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


    top_features: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True
    )
    explanation_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)



    prediction_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    feature_snapshot_version: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    cutoff_used_utc: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )


    learner: Mapped["Learner"] = relationship(
        back_populates="predictions", foreign_keys=[user_id]
    )


class UserCourseProgress(db.Model):
    __tablename__ = 'user_course_progress'
    
    user_id: Mapped[int] = mapped_column(
        db.ForeignKey('learner.user_id', ondelete='CASCADE'), primary_key=True
    )
    course_id: Mapped[int] = mapped_column(
        db.ForeignKey('course.course_id', ondelete='CASCADE'), primary_key=True
    )
    
    #is_completed: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True), nullable=True)
    progress_percent: Mapped[float] = mapped_column(db.Float, default=0.0, nullable=False)
    last_activity_utc: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True), nullable=True)
    
    #learner = db.relationship("Learner", back_populates="course_progress")
    #course = db.relationship("Course", back_populates="user_progress")