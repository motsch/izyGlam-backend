import PostModel from "../models/post";
import ArchivedPostModel from "../models/archivedPost";

async function archivePosts() {
  const now = new Date();
  const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // Mois précédent
  const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(); // Année du mois précédent

  console.log(`Archiving posts for ${previousMonth}/${previousYear}...`);

  try {
    // Récupérer tous les posts du mois précédent
    const postsToArchive = await PostModel.find({
      month: previousMonth,
      year: previousYear,
    });

    if (postsToArchive.length === 0) {
      console.log("No posts to archive.");
      return;
    }

    // Préparer les données pour l'archivage
    const archivedPosts = postsToArchive.map((post) => ({
      userId: post.userId,
      scheduled_time: post.scheduled_time,
      month: post.month,
      year: post.year,
      content: post.content,
      imageUrl: post.imageUrl,
      platform: post.platform,
      status: "archived",
      performance: {
        likes: 0, // Placeholder, à récupérer via une API ou autre méthode
        shares: 0,
        comments: 0,
      },
    }));

    // Insérer les posts dans la collection des archives
    await ArchivedPostModel.insertMany(archivedPosts);

    // Supprimer les posts archivés de la collection d'origine
    await PostModel.deleteMany({
      month: previousMonth,
      year: previousYear,
    });

    console.log(`${archivedPosts.length} posts archived successfully.`);
  } catch (error) {
    console.error("Error while archiving posts:", error);
  }
}

export { archivePosts };
