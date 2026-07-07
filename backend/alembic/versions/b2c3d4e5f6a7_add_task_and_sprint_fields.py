"""add task and sprint fields for sprint planning

Revision ID: b2c3d4e5f6a7
Revises: fa108f67f767
Create Date: 2026-06-30 06:35:00.000000

Changes:
  - tasks: add due_date, estimated_hours, created_by
  - tasks: drop ck_tasks_effort_points_fibonacci CHECK constraint
  - tasks: make effort_points nullable
  - sprints: add goal column
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'eeb0b183a63e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── tasks table ──────────────────────────────────────────────────────
    # Drop the Fibonacci CHECK constraint first
    op.drop_constraint('ck_tasks_effort_points_fibonacci', 'tasks', type_='check')

    # Make effort_points nullable (keeps existing rows intact)
    op.alter_column('tasks', 'effort_points', nullable=True)

    # Add new columns (all nullable so existing rows are not broken)
    op.add_column('tasks', sa.Column('due_date',        sa.Date(),  nullable=True))
    op.add_column('tasks', sa.Column('estimated_hours', sa.Float(), nullable=True))
    op.add_column('tasks', sa.Column('created_by',      sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_tasks_created_by_users',
        'tasks', 'users',
        ['created_by'], ['id']
    )

    # ── sprints table ────────────────────────────────────────────────────
    op.add_column('sprints', sa.Column('goal', sa.Text(), nullable=True))


def downgrade() -> None:
    # sprints
    op.drop_column('sprints', 'goal')

    # tasks
    op.drop_constraint('fk_tasks_created_by_users', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'created_by')
    op.drop_column('tasks', 'estimated_hours')
    op.drop_column('tasks', 'due_date')

    op.alter_column('tasks', 'effort_points', nullable=False)
    op.create_check_constraint(
        'ck_tasks_effort_points_fibonacci',
        'tasks',
        'effort_points IN (1, 2, 3, 5, 8, 13)'
    )
