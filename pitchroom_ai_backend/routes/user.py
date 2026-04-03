from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from pitchroom_ai_backend.database.mongo import get_db
from pitchroom_ai_backend.models.user_profile import UserAggregationResponse, UserFullProfile
from pitchroom_ai_backend.services.user_aggregation_service import user_aggregation_service
from pitchroom_ai_backend.utils.deps import get_current_user


router = APIRouter(prefix="/user", tags=["user"])


@router.get("/full-profile/{user_id}", response_model=UserAggregationResponse)
async def get_full_user_profile(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    page: int = Query(default=1, ge=1, description="Page number"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> UserAggregationResponse:
    """
    Fetch comprehensive user profile aggregating data across all collections.

    Returns user info, profile, scripts, engagement, messages, conversations,
    notifications, posts, uploads, collections, characters, and stories.

    Query Parameters:
    - limit: Number of items per page (1-100, default 20)
    - page: Page number (default 1)
    """
    # Security: Ensure user can only access their own data
    if str(current_user.get("_id")) != user_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own profile",
        )

    try:
        profile = await user_aggregation_service.get_full_user_profile(db, user_id, limit, page)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return UserAggregationResponse(
            success=True,
            data=profile,
            message="User profile aggregated successfully",
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user profile: {str(exc)}",
        ) from exc


@router.get("/profile-summary/{user_id}", response_model=dict)
async def get_user_profile_summary(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Fetch lightweight user profile summary (stats only, no detailed data).

    Useful for user cards, lists, profile previews.
    """
    # Security: Ensure user can only access their own data
    if str(current_user.get("_id")) != user_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own profile",
        )

    try:
        user_basic = await user_aggregation_service.get_user_basic(db, user_id)
        if not user_basic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user_profile = await user_aggregation_service.get_user_profile(db, user_id)
        stats = await user_aggregation_service.get_user_stats(db, user_id)

        return {
            "success": True,
            "user": {
                "id": str(user_basic.get("_id")),
                "name": user_basic.get("name"),
                "email": user_basic.get("email"),
                "role": user_basic.get("role"),
            },
            "profile": {
                "bio": user_profile.get("bio") if user_profile else None,
                "avatar_url": user_profile.get("avatar_url") if user_profile else None,
                "followers_count": user_profile.get("followers_count", 0) if user_profile else 0,
            },
            "stats": stats,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user summary: {str(exc)}",
        ) from exc
