from django.urls import path

from .views import (
    EventView,
    ExperienceDismissView,
    ExperienceOfferView,
    HeartbeatView,
    PendingView,
    PlayerView,
    PlayListView,
    PlaysView,
    ReconcileView,
    ResultView,
    ResumeView,
    TurnView,
)

urlpatterns = [
    path("players", PlayerView.as_view(), name="players"),
    path("players/me/plays", PlayListView.as_view(), name="play-list"),
    path("plays", PlaysView.as_view(), name="plays"),
    path("plays/<str:play_id>", ResumeView.as_view(), name="resume"),
    path("plays/<str:play_id>/turns", TurnView.as_view(), name="turns"),
    path("plays/<str:play_id>/experience-heartbeat", HeartbeatView.as_view(), name="heartbeat"),
    path("plays/<str:play_id>/experience-pending", PendingView.as_view(), name="pending"),
    path("plays/<str:play_id>/experience-events", EventView.as_view(), name="events"),
    path(
        "plays/<str:play_id>/experience-offers",
        ExperienceOfferView.as_view(),
        name="experience-offers",
    ),
    path(
        "plays/<str:play_id>/experience-offers/dismiss",
        ExperienceDismissView.as_view(),
        name="experience-dismiss",
    ),
    path("plays/<str:play_id>/experience-reconcile", ReconcileView.as_view(), name="reconcile"),
    path("plays/<str:play_id>/result", ResultView.as_view(), name="result"),
]
