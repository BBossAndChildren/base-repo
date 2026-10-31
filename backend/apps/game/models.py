import uuid

from django.db import models
from django.utils import timezone


class Player(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "players"


class Play(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="plays")
    profile = models.JSONField(default=dict)
    state = models.JSONField(default=dict)
    experience_results = models.JSONField(default=list)
    ended = models.BooleanField(default=False)
    ending = models.JSONField(null=True, blank=True)
    messages = models.JSONField(default=list)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    summary = models.TextField(blank=True)
    result = models.JSONField(null=True, blank=True)
    turn_token = models.UUIDField(null=True, blank=True)
    turn_expires_at = models.DateTimeField(null=True, blank=True)
    state_version = models.PositiveBigIntegerField(default=0)
    paused = models.BooleanField(default=False)
    active_seconds = models.FloatField(default=0)
    turn_started_at = models.DateTimeField(null=True, blank=True)
    progress = models.JSONField(default=dict)

    class Meta:
        db_table = "plays"


class Turn(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    play = models.ForeignKey(Play, on_delete=models.CASCADE, related_name="turns")
    number = models.PositiveIntegerField()
    input = models.TextField()
    response = models.JSONField()
    context = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["play", "number"], name="unique_play_turn")]


class TurnRequest(models.Model):
    play = models.ForeignKey(Play, on_delete=models.CASCADE, related_name="turn_requests")
    request_id = models.UUIDField()
    input = models.TextField()
    state_version = models.PositiveBigIntegerField()
    status = models.CharField(max_length=20, default="pending")
    response = models.JSONField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["play", "request_id"], name="unique_play_request")
        ]


class NPC(models.Model):
    play = models.ForeignKey(Play, on_delete=models.CASCADE, related_name="npcs")
    key = models.CharField(max_length=100)
    name = models.CharField(max_length=200)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["play", "key"], name="unique_play_npc")]


class GameEvent(models.Model):
    play = models.ForeignKey(Play, on_delete=models.CASCADE, related_name="game_events")
    key = models.CharField(max_length=200)
    kind = models.CharField(max_length=50)
    game_date = models.DateField()
    participants = models.JSONField(default=list)
    facts = models.JSONField()
    source_action = models.CharField(max_length=200)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["play", "key"], name="unique_play_event")]


class NPCMemory(models.Model):
    npc = models.ForeignKey(NPC, on_delete=models.CASCADE, related_name="memories")
    event = models.ForeignKey(GameEvent, on_delete=models.CASCADE, related_name="memories")
    acquisition = models.CharField(max_length=20)
    emotion = models.TextField(blank=True)
    interpretation = models.TextField(blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["npc", "event"], name="unique_npc_memory")]


class InformationTransfer(models.Model):
    sender = models.ForeignKey(NPC, on_delete=models.CASCADE, related_name="sent_information")
    recipient = models.ForeignKey(
        NPC, on_delete=models.CASCADE, related_name="received_information"
    )
    event = models.ForeignKey(GameEvent, on_delete=models.CASCADE)
    trigger = models.CharField(max_length=30)
    game_date = models.DateField()
    source_action = models.CharField(max_length=200)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["sender", "recipient", "event"], name="unique_information_transfer"
            )
        ]


class Message(models.Model):
    play = models.ForeignKey(Play, on_delete=models.CASCADE, related_name="message_rows")
    turn = models.PositiveIntegerField()
    role = models.CharField(max_length=20)
    speaker = models.CharField(max_length=200, null=True, blank=True)
    text = models.TextField()
    state_changes = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["play", "turn"], name="message_play_turn_idx")]
        db_table = "messages"


class Experience(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_id = models.CharField(max_length=200, unique=True)
    play = models.ForeignKey(Play, on_delete=models.CASCADE, related_name="experiences")
    session_id = models.CharField(max_length=200, blank=True)
    metadata = models.JSONField()
    build_id = models.CharField(max_length=200, blank=True)
    room_id = models.CharField(max_length=200, blank=True)
    scenario_id = models.CharField(max_length=200, blank=True)
    scenario_version = models.CharField(max_length=200, blank=True)
    lifecycle_status = models.CharField(max_length=32, default="recommended")
    pending_request_id = models.CharField(max_length=200, blank=True)
    lease_expires_at = models.DateTimeField(null=True, blank=True)
    started_observed = models.BooleanField(default=False)
    fenced = models.BooleanField(default=False)
    ended_event = models.JSONField(null=True, blank=True)
    ended_event_id = models.CharField(max_length=200, blank=True)
    result_summary = models.JSONField(null=True, blank=True)
    terminal_event = models.JSONField(null=True, blank=True)
    last_sequence = models.IntegerField(default=-1)
    last_event = models.JSONField(null=True, blank=True)
    snapshots = models.JSONField(default=dict)
    resolution_id = models.UUIDField(default=uuid.uuid4, editable=False)
    revision = models.PositiveIntegerField(default=0)
    latest_resolution = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "experiences"


class ExperienceEvent(models.Model):
    experience = models.ForeignKey(Experience, on_delete=models.CASCADE, related_name="events")
    session_id = models.CharField(max_length=200)
    event_id = models.CharField(max_length=200)
    sequence = models.IntegerField(default=-1)
    type = models.CharField(max_length=100, blank=True)
    scope_key = models.CharField(max_length=500, blank=True)
    payload = models.JSONField()
    payload_hash = models.CharField(max_length=64, blank=True)
    conflict = models.BooleanField(default=False)
    quarantined = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session_id", "event_id"], name="unique_unity_event")
        ]
        db_table = "experience_events"


class ExperienceEventConflict(models.Model):
    experience = models.ForeignKey(Experience, on_delete=models.CASCADE, related_name="conflicts")
    session_id = models.CharField(max_length=200)
    event_id = models.CharField(max_length=200)
    payload = models.JSONField()
    received_at = models.DateTimeField(auto_now_add=True)


class ReconcileRequest(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    request_id = models.CharField(max_length=200)
    payload = models.JSONField()
    response = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["player", "request_id"], name="unique_owner_reconcile_request"
            )
        ]


class ResolutionRevision(models.Model):
    experience = models.ForeignKey(Experience, on_delete=models.CASCADE, related_name="revisions")
    resolution_id = models.UUIDField(null=True)
    revision = models.PositiveIntegerField()
    reconcile_request_id = models.CharField(max_length=200, blank=True)
    lifecycle_status = models.CharField(max_length=32, blank=True)
    payload = models.JSONField(default=dict)
    response = models.JSONField()
    verification_evidence = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["experience", "revision"], name="unique_resolution_revision"
            ),
            models.UniqueConstraint(
                fields=["resolution_id", "revision"], name="unique_resolution_id_revision"
            ),
        ]
        db_table = "experience_resolutions"
