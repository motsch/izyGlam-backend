import axios from "axios";

export const getInstagramComments = async (accessToken: string, mediaId: string) => {
  try {
    const url = `https://graph.instagram.com/${mediaId}/comments`;
    const response = await axios.get(url, {
      params: { access_token: accessToken },
    });
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des commentaires Instagram :", error);
    throw error;
  }
};

export const replyToInstagramComment = async (accessToken: string, commentId: string, text: string) => {
  try {
    const url = `https://graph.instagram.com/${commentId}/replies`;
    const response = await axios.post(
      url,
      { text },
      {
        params: { access_token: accessToken },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la réponse au commentaire Instagram :", error);
    throw error;
  }
};
