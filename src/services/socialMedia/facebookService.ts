import axios from "axios";

export const getFacebookComments = async (accessToken: string, postId: string) => {
  try {
    const url = `https://graph.facebook.com/v12.0/${postId}/comments`;
    const response = await axios.get(url, {
      params: { access_token: accessToken },
    });
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des commentaires Facebook :", error);
    throw error;
  }
};

export const replyToFacebookComment = async (accessToken: string, commentId: string, message: string) => {
  try {
    const url = `https://graph.facebook.com/v12.0/${commentId}/comments`;
    const response = await axios.post(
      url,
      { message },
      {
        params: { access_token: accessToken },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la réponse au commentaire Facebook :", error);
    throw error;
  }
};
