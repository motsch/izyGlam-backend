import axios from "axios";

export const getTikTokComments = async (accessToken: string, videoId: string) => {
  try {
    const url = `https://open.tiktokapis.com/v1/videos/${videoId}/comments`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des commentaires TikTok :", error);
    throw error;
  }
};

export const replyToTikTokComment = async (accessToken: string, commentId: string, message: string) => {
  try {
    const url = `https://open.tiktokapis.com/v1/comments/${commentId}/replies`;
    const response = await axios.post(
      url,
      { message },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la réponse au commentaire TikTok :", error);
    throw error;
  }
};
