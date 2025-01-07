import axios from "axios";
import https from "https";
import PostModel from "../models/post";
import cron from "node-cron";

// Variable pour éviter les exécutions concurrentes
let isProcessing = false;

// Fonction pour envoyer les posts
async function sendPost(post: any) {
    try {
        console.log(`Sending post for user ${post.userId}: ${post.content}`);
        // Exemple d'envoi via une API avec axios
        const response = await axios.post(
            "https://api.socialmedia.com/send",
            { content: post.content, userId: post.userId },
            {
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                timeout: 5000, // Timeout pour éviter les blocages prolongés
            }
        );

        if (response.status === 200) {
            // Marquer comme envoyé
            await PostModel.updateOne({ _id: post._id }, { status: "sent" });
            console.log(`Post ${post._id} sent successfully.`);
        } else {
            console.error(`Failed to send post ${post._id}: Unexpected status`);
            await PostModel.updateOne({ _id: post._id }, { status: "failed" });
        }
    } catch (error:any) {
        console.error(`Failed to send post ${post._id}:`, error.message);
        // Marquer comme échoué
        await PostModel.updateOne({ _id: post._id }, { status: "failed" });
    }
}

// Tâche planifiée pour récupérer et envoyer les posts
async function processPosts() {
    if (isProcessing) {
        console.log("Process already running, skipping this cycle.");
        return;
    }

    isProcessing = true; // Verrouillage pour éviter la concurrence

    try {
        const now = new Date();
        const nextFiveMinutes = new Date(now.getTime() + 5 * 60 * 1000);

        // Récupérer les posts à envoyer dans les 5 prochaines minutes
        const posts = await PostModel.find({
            scheduled_time: { $gte: now, $lt: nextFiveMinutes },
            status: "pending",
        }).limit(100); // Limite pour réduire la charge

        console.log(`Found ${posts.length} posts to send.`);

        // Envoyer les posts un par un
        for (const post of posts) {
            await sendPost(post); // Attendre la fin de chaque envoi
        }
    } catch (error:any) {
        console.error("Error processing posts:", error.message);
    } finally {
        isProcessing = false; // Libérer le verrou
    }
}

// Initialiser et démarrer le service
function startAPIService() {
    console.log("Initializing Post Scheduler Service...");

    // Planifier la tâche toutes les minutes
    cron.schedule("* * * * *", processPosts);

    console.log("Post Scheduler Service started.");
}

export { startAPIService };
