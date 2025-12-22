/**
 * Social Content Fetchers
 *
 * Each fetcher retrieves content from a social platform using OAuth tokens.
 * Returns raw text content for summarization.
 */

import { SocialProvider } from "@/types";

export interface FetchedContent {
  content: string;
  handle: string | null;
  postCount: number;
}

/**
 * Fetch Facebook posts for a user
 */
async function fetchFacebookContent(accessToken: string): Promise<FetchedContent> {
  // Get user profile
  const profileResponse = await fetch(
    `https://graph.facebook.com/v18.0/me?fields=name&access_token=${accessToken}`
  );

  if (!profileResponse.ok) {
    throw new Error("Failed to fetch Facebook profile");
  }

  const profile = await profileResponse.json();

  // Get recent posts
  const postsResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/posts?fields=message,created_time&limit=50&access_token=${accessToken}`
  );

  if (!postsResponse.ok) {
    throw new Error("Failed to fetch Facebook posts");
  }

  const posts = await postsResponse.json();

  // Combine post messages
  const content = (posts.data || [])
    .filter((post: any) => post.message)
    .map((post: any) => post.message)
    .join("\n\n---\n\n");

  return {
    content,
    handle: profile.name || null,
    postCount: posts.data?.length || 0,
  };
}

/**
 * Fetch Instagram media captions for a user
 */
async function fetchInstagramContent(accessToken: string): Promise<FetchedContent> {
  // Get user profile
  const profileResponse = await fetch(
    `https://graph.instagram.com/me?fields=username&access_token=${accessToken}`
  );

  if (!profileResponse.ok) {
    throw new Error("Failed to fetch Instagram profile");
  }

  const profile = await profileResponse.json();

  // Get recent media
  const mediaResponse = await fetch(
    `https://graph.instagram.com/me/media?fields=caption,timestamp&limit=50&access_token=${accessToken}`
  );

  if (!mediaResponse.ok) {
    throw new Error("Failed to fetch Instagram media");
  }

  const media = await mediaResponse.json();

  // Combine captions
  const content = (media.data || [])
    .filter((item: any) => item.caption)
    .map((item: any) => item.caption)
    .join("\n\n---\n\n");

  return {
    content,
    handle: profile.username ? `@${profile.username}` : null,
    postCount: media.data?.length || 0,
  };
}

/**
 * Fetch TikTok profile for a user
 * MVP: Uses only user.info.basic scope (auto-approved in sandbox)
 * TODO: Add user.info.profile and user.info.stats after portal approval
 */
async function fetchTikTokContent(accessToken: string): Promise<FetchedContent> {
  // MVP: Only request fields available with user.info.basic scope
  // - user.info.basic: display_name, avatar_url, open_id
  // Future (after approval): username, bio_description, is_verified, follower_count, etc.
  const userResponse = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!userResponse.ok) {
    throw new Error("Failed to fetch TikTok user info");
  }

  const userData = await userResponse.json();
  const user = userData.data?.user;

  if (!user) {
    throw new Error("No user data returned from TikTok");
  }

  // Build content from basic profile info only
  const contentParts: string[] = [];

  if (user.display_name) {
    contentParts.push(`TikTok User: ${user.display_name}`);
  }

  // MVP: Minimal content for AI summary
  const content = contentParts.length > 0
    ? contentParts.join("\n\n")
    : "TikTok account connected";

  return {
    content,
    handle: user.display_name || null, // No @username without user.info.profile scope
    postCount: 1, // Profile counts as 1 item
  };
}

/**
 * Fetch X (Twitter) tweets for a user
 */
async function fetchXContent(accessToken: string): Promise<FetchedContent> {
  // Get authenticated user
  const meResponse = await fetch("https://api.twitter.com/2/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!meResponse.ok) {
    throw new Error("Failed to fetch X user info");
  }

  const meData = await meResponse.json();
  const userId = meData.data?.id;
  const username = meData.data?.username;

  if (!userId) {
    throw new Error("Could not get X user ID");
  }

  // Get user's tweets
  const tweetsResponse = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?max_results=100&tweet.fields=text,created_at`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!tweetsResponse.ok) {
    throw new Error("Failed to fetch X tweets");
  }

  const tweetsData = await tweetsResponse.json();
  const tweets = tweetsData.data || [];

  // Combine tweet texts
  const content = tweets.map((t: any) => t.text).join("\n\n---\n\n");

  return {
    content,
    handle: username ? `@${username}` : null,
    postCount: tweets.length,
  };
}

/**
 * Fetch Reddit comments and posts for a user
 */
async function fetchRedditContent(accessToken: string): Promise<FetchedContent> {
  // Get user identity
  const meResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Solara/1.0",
    },
  });

  if (!meResponse.ok) {
    throw new Error("Failed to fetch Reddit user info");
  }

  const meData = await meResponse.json();
  const username = meData.name;

  if (!username) {
    throw new Error("Could not get Reddit username");
  }

  // Get user's comments
  const commentsResponse = await fetch(
    `https://oauth.reddit.com/user/${username}/comments?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Solara/1.0",
      },
    }
  );

  // Get user's posts
  const postsResponse = await fetch(
    `https://oauth.reddit.com/user/${username}/submitted?limit=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Solara/1.0",
      },
    }
  );

  const commentsData = commentsResponse.ok ? await commentsResponse.json() : { data: { children: [] } };
  const postsData = postsResponse.ok ? await postsResponse.json() : { data: { children: [] } };

  const comments = commentsData.data?.children || [];
  const posts = postsData.data?.children || [];

  // Combine content
  const commentTexts = comments
    .map((c: any) => c.data?.body)
    .filter(Boolean);

  const postTexts = posts
    .map((p: any) => p.data?.selftext || p.data?.title)
    .filter(Boolean);

  const content = [...commentTexts, ...postTexts].join("\n\n---\n\n");

  return {
    content,
    handle: `u/${username}`,
    postCount: comments.length + posts.length,
  };
}

/**
 * Fetch content from a social provider
 */
export async function fetchSocialContent(
  provider: SocialProvider,
  accessToken: string
): Promise<FetchedContent> {
  switch (provider) {
    case "facebook":
      return fetchFacebookContent(accessToken);
    case "instagram":
      return fetchInstagramContent(accessToken);
    case "tiktok":
      return fetchTikTokContent(accessToken);
    case "x":
      return fetchXContent(accessToken);
    case "reddit":
      return fetchRedditContent(accessToken);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
