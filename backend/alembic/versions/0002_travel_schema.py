"""smart travel schema

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-09 20:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # travel_trips
    op.create_table(
        'travel_trips',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('workspace_id', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('origin_name', sa.String(length=200), nullable=False),
        sa.Column('origin_lat', sa.Float(), nullable=False),
        sa.Column('origin_lng', sa.Float(), nullable=False),
        sa.Column('destination_name', sa.String(length=200), nullable=False),
        sa.Column('destination_lat', sa.Float(), nullable=False),
        sa.Column('destination_lng', sa.Float(), nullable=False),
        sa.Column('departure_date', sa.String(length=50), nullable=True),
        sa.Column('return_date', sa.String(length=50), nullable=True),
        sa.Column('is_one_way', sa.Boolean(), nullable=False),
        sa.Column('adults', sa.Integer(), nullable=False),
        sa.Column('children', sa.Integer(), nullable=False),
        sa.Column('older_travellers', sa.Integer(), nullable=False),
        sa.Column('travel_mode', sa.String(length=30), nullable=False),
        sa.Column('vehicle_profile_id', sa.String(length=36), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['vehicle_profile_id'], ['vehicle_profiles.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_travel_trips_ws_status', 'travel_trips', ['workspace_id', 'status'])

    # travel_preferences
    op.create_table(
        'travel_preferences',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('trip_id', sa.String(length=36), nullable=False),
        sa.Column('pace', sa.String(length=30), nullable=False),
        sa.Column('budget_category', sa.String(length=30), nullable=False),
        sa.Column('total_budget_inr', sa.Float(), nullable=True),
        sa.Column('accommodation_types', sa.JSON(), nullable=False),
        sa.Column('max_price_per_night', sa.Float(), nullable=True),
        sa.Column('food_preference', sa.String(length=30), nullable=False),
        sa.Column('interests', sa.JSON(), nullable=False),
        sa.Column('max_drive_hours_per_day', sa.Float(), nullable=False),
        sa.Column('max_drive_km_per_day', sa.Float(), nullable=True),
        sa.Column('avoid_night_driving', sa.Boolean(), nullable=False),
        sa.Column('meal_budget_per_person', sa.Float(), nullable=True),
        sa.Column('contingency_pct', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['travel_trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_id')
    )

    # travel_checkpoints
    op.create_table(
        'travel_checkpoints',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('trip_id', sa.String(length=36), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('type', sa.String(length=30), nullable=False),
        sa.Column('is_mandatory', sa.Boolean(), nullable=False),
        sa.Column('stay_overnight', sa.Boolean(), nullable=False),
        sa.Column('planned_arrival', sa.String(length=50), nullable=True),
        sa.Column('planned_departure', sa.String(length=50), nullable=True),
        sa.Column('activity_duration_min', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('distance_from_prev_km', sa.Float(), nullable=True),
        sa.Column('duration_from_prev_min', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['travel_trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_travel_cp_trip_seq', 'travel_checkpoints', ['trip_id', 'sequence'])

    # travel_route_options
    op.create_table(
        'travel_route_options',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('trip_id', sa.String(length=36), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('total_distance_km', sa.Float(), nullable=False),
        sa.Column('total_duration_min', sa.Float(), nullable=False),
        sa.Column('estimated_days', sa.Integer(), nullable=False),
        sa.Column('estimated_fuel_cost_inr', sa.Float(), nullable=True),
        sa.Column('estimated_total_cost_inr', sa.Float(), nullable=True),
        sa.Column('geometry', sa.JSON(), nullable=False),
        sa.Column('checkpoints', sa.JSON(), nullable=False),
        sa.Column('is_selected', sa.Boolean(), nullable=False),
        sa.Column('data_source', sa.String(length=50), nullable=False),
        sa.Column('fallback_estimate', sa.Boolean(), nullable=False),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['travel_trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # travel_places
    op.create_table(
        'travel_places',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('trip_id', sa.String(length=36), nullable=False),
        sa.Column('checkpoint_id', sa.String(length=36), nullable=True),
        sa.Column('category', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('rating', sa.Float(), nullable=True),
        sa.Column('review_count', sa.Integer(), nullable=True),
        sa.Column('price_min', sa.Float(), nullable=True),
        sa.Column('price_max', sa.Float(), nullable=True),
        sa.Column('price_label', sa.String(length=100), nullable=True),
        sa.Column('amenities', sa.JSON(), nullable=False),
        sa.Column('opening_hours', sa.String(length=100), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('last_checked', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_selected', sa.Boolean(), nullable=False),
        sa.Column('distance_from_route_km', sa.Float(), nullable=True),
        sa.Column('detour_km', sa.Float(), nullable=True),
        sa.Column('estimated_visit_min', sa.Integer(), nullable=True),
        sa.Column('entry_price_inr', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['travel_trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_travel_places_trip_cat', 'travel_places', ['trip_id', 'category'])

    # travel_itinerary_days
    op.create_table(
        'travel_itinerary_days',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('trip_id', sa.String(length=36), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('date', sa.String(length=50), nullable=True),
        sa.Column('start_checkpoint_id', sa.String(length=36), nullable=True),
        sa.Column('end_checkpoint_id', sa.String(length=36), nullable=True),
        sa.Column('drive_distance_km', sa.Float(), nullable=False),
        sa.Column('drive_duration_min', sa.Float(), nullable=False),
        sa.Column('estimated_cost_inr', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('items', sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['travel_trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_travel_itinerary_day', 'travel_itinerary_days', ['trip_id', 'day_number'])


def downgrade() -> None:
    op.drop_table('travel_itinerary_days')
    op.drop_table('travel_places')
    op.drop_table('travel_route_options')
    op.drop_table('travel_checkpoints')
    op.drop_table('travel_preferences')
    op.drop_table('travel_trips')
