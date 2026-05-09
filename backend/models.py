from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, Text, func
)
from sqlalchemy.orm import (
    Mapped, mapped_column, relationship
)

from config import db

class Course(db.Model):
    __tablename__ = 'course'

    course_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    discrimination: Mapped[float] = mapped_column(Float, default=0.5)

    modules: Mapped[List["Module"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
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

    lesson: Mapped["Lesson"] = relationship(back_populates="steps")
    submissions: Mapped[List["Submission"]] = relationship(
        back_populates="step", cascade="all, delete-orphan"
    )
    comments: Mapped[List["Comment"]] = relationship(
        back_populates="step", cascade="all, delete-orphan"
    )


class Learner(db.Model):
    __tablename__ = 'learner'

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


class Submission(db.Model):
    __tablename__ = 'submission'
    __table_args__ = (
        Index('idx_submission_step', 'step_id'),
        Index('idx_submission_user', 'user_id'),
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
    reply_clear: Mapped[bool] = mapped_column(Boolean, default=False)
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