import { getFacebookComments, replyToFacebookComment } from "./facebookService";
import { getInstagramComments, replyToInstagramComment } from "./instagramService";
import { getTikTokComments, replyToTikTokComment } from "./tiktokService";

export const fetchCommentsByPlatform = async (
  platform: string,
  accessToken: string,
  postId: string
) => {
  switch (platform) {
    case "facebook":
      return await getFacebookComments(accessToken, postId);
    case "instagram":
      return await getInstagramComments(accessToken, postId);
    case "tiktok":
      return await getTikTokComments(accessToken, postId);
    default:
      throw new Error(`La plateforme ${platform} n'est pas prise en charge.`);
  }
};

export const replyToCommentByPlatform = async (
  platform: string,
  accessToken: string,
  commentId: string,
  message: string
) => {
  switch (platform) {
    case "facebook":
      return await replyToFacebookComment(accessToken, commentId, message);
    case "instagram":
      return await replyToInstagramComment(accessToken, commentId, message);
    case "tiktok":
      return await replyToTikTokComment(accessToken, commentId, message);
    default:
      throw new Error(`La plateforme ${platform} n'est pas prise en charge.`);
  }
};
