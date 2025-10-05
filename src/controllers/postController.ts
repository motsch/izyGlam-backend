import axios from "axios";
import * as express from "express";
import PostModel from "../models/post";
import SubscriptionModel from "../models/subscription";
import ProfileModel from "../models/profile";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

function generateDynamicCategoriesPrompt(
  categories: { name: string }[]
): string {
  if (categories.length === 0) {
    return "Les posts doivent aborder des sujets variés pour toucher un public large et général.";
  }

  const categoryNames = categories.map((category) =>
    category.name.toLowerCase()
  );

  if (categoryNames.length === 1) {
    return `Chaque post doit aborder un sujet lié à ${categoryNames[0]}.`;
  }

  const lastCategory = categoryNames.pop(); // Retire le dernier élément pour "et"
  return `Les posts doivent aborder des sujets variés, incluant ${categoryNames.join(
    ", "
  )} et ${lastCategory}.`;
}

function generateDynamicHighlightsSentence(
  highlights: { name: string }[]
): string {
  if (highlights.length === 0) {
    return "Je souhaite un mélange homogène de posts variés.";
  }

  const highlightNames = highlights.map((highlight) => highlight.name);

  if (highlightNames.length === 1) {
    return `Je souhaite un mélange homogène de posts autour de ${highlightNames[0].toLowerCase()}.`;
  }

  const lastHighlight = highlightNames.pop(); // Retire le dernier élément pour l'utiliser dans "et"
  return `Je souhaite un mélange homogène de posts autour de ${highlightNames
    .map((highlight) => highlight.toLowerCase())
    .join(", ")} et ${lastHighlight!.toLowerCase()}.`;
}

function generateDynamicSentence(tones: { name: string }[]): string {
  if (tones.length === 0) {
    return "Je souhaite un équilibre entre différents types de posts.";
  }

  const toneNames = tones.map((tone) => tone.name);

  if (toneNames.length === 1) {
    return `Je souhaite un équilibre entre des posts ${toneNames[0].toLowerCase()} et des posts promotionnels.`;
  }

  const lastTone = toneNames.pop(); // Retire le dernier ton pour l'utiliser dans "et"
  return `Je souhaite un équilibre entre des posts ${toneNames
    .map((tone) => tone.toLowerCase())
    .join(
      ", "
    )} et ${lastTone!.toLowerCase()} ainsi que des posts promotionnels.`;
}

// Génération des posts mensuels via OpenAI en fonction du profil utilisateur
export const generateMonthlyPostsWithOpenAI = async (
  userId: string,
  month: number,
  year: number,
  socialNetwork: string
) => {
  // Cherche le profil actif de l'utilisateur
  const userProfile = await ProfileModel.findOne({ userId, active: true });
  if (!userProfile) {
    throw new Error("Profil actif non trouvé pour cet utilisateur.");
  }
  console.log("userProfile : ", userProfile);

  /**
   * Récupération de l'abonnement actif de l'utilisateur
   * Vérification de l'abonnement actif de l'utilisateur
   */

  // En fonction de l'abonnement, déterminer le nombre de publications dans le mois.
  const publicationFrequency = 8;

  const tonSentence = generateDynamicSentence(userProfile.tones);
  const highlightsSentence = generateDynamicHighlightsSentence(
    userProfile.highlights
  );
  const categoriesSentence = generateDynamicCategoriesPrompt(
    userProfile.categories
  );

  // Crée un prompt personnalisé avec les informations du profil utilisateur
  const prompt = `
Agis comme un créateur de contenu pour les réseaux sociaux. J'ai besoin d'un calendrier de contenu pour ${socialNetwork}, contenant ${publicationFrequency} publications.
${categoriesSentence}
${highlightsSentence}
${tonSentence}

Chaque post doit inclure :
- une légende (en ${userProfile.language})
- une date et une heure de diffusion idéale pour un post de ${userProfile.activity.name} sur ${socialNetwork}. Ce post sera à à destination du pays : ${userProfile.country}
- une suggestion d'image en ${userProfile.language}
- un prompt d'image (en anglais) pour Midjourney, avec description, mots-clés de style (en ${userProfile.language}), type de caméra (en ${userProfile.language}), objectif (en ${userProfile.language}), et techniques de post-traitement (en ${userProfile.language}). Le style de l'image sera ${userProfile.visualStyle}, toujours en FULL HD.

Certain posts (10%), aborderont cette spécificité: ${userProfile.introduction} 

### Structure des publications :
La réponse doit fournir le calendrier sous une structure unique, sans découpage ni balises inutiles. Voici un exemple de format :

{
  "content_calendar": [
    {
      "type": "ton. ex: engaging",
      "date": "date idéale de publication pour le mois de ${month}",
      heure: "heure de publication idéale pour ce post",
      "caption": "Texte sur le ton désiré, dans la langue désirée.",
      "hashtags": ["hashtag", "hashtag", "hashtag"],
      "suggested_image": "Description de l'image, dans la langue désirée",
      "image_prompt": {
        "description": "Description en anglais pour Midjourney",
        "style_keywords": ["mot-clé1", "mot-clé2", "mot-clé3"],
        "camera": "Modèle de caméra",
        "lens": "Type d'objectif",
        "post_processing": "Techniques de post-traitement"
      }
    },
    // Répéter cette structure pour chaque publication
  ]
}

Renvoie uniquement l'objet JSON du calendrier complet et structuré sans coupure. Assure-toi que tout le calendrier soit inclus dans un seul bloc de réponse.
`;

  console.log("prompt : ", prompt);

  // Appel à OpenAI pour générer les posts
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Tu es un assistant pour générer des posts personnalisés.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  // Parse la réponse JSON et extrait le contenu structuré
  const generatedContent = JSON.parse(response.data.choices[0].message.content);

  // Vérifie que generatedContent est bien au format attendu
  if (!generatedContent || !generatedContent.content_calendar) {
    throw new Error("Le format de la réponse d'OpenAI n'est pas valide.");
  }

  // Crée les posts à enregistrer dans la base de données
  const generatedPosts = generatedContent.content_calendar.map((post: any) => ({
    userId,
    month,
    year,
    content: JSON.stringify(post),
  }));

  return generatedPosts;
};

// Génération d'un post afin de faire un update dans la table
// Génération d'un post afin de faire un update dans la table
export const generateONEPostsWithOpenAI = async (userId: string, platform: string) => {
  // Cherche le profil actif de l'utilisateur
  const userProfile = await ProfileModel.findOne({ userId, active: true });
  if (!userProfile) {
    throw new Error("Profil actif non trouvé pour cet utilisateur.");
  }
  console.log("userProfile : ", userProfile);

  // Génère un prompt personnalisé en fonction de la plateforme
  const platformSpecifics: any = {
    Facebook: {
      style: "informel et engageant",
      structure: "Un post qui connecte personnellement, avec une anecdote ou une réflexion, suivi d'un appel à l'action léger.",
      hashtagsCount: 5,
    },
    Instagram: {
      style: "visuellement attrayant et émotionnel",
      structure: "Une légende captivante accompagnée d'une description imagée parfaite pour Instagram.",
      hashtagsCount: 10,
    },
    LinkedIn: {
      style: "professionnel et éducatif",
      structure: "Introduction engageante, développement structuré (conseils ou partages d'expérience ou anecdote), une phrase pour engager l'audiance et une conclusion inspirante.",
      hashtagsCount: 5,
    },
    Bluesky: {
      style: "créatif et léger",
      structure: "Un post concis, original et souvent accompagné d'une image ou d'un GIF humoristique.",
      hashtagsCount: 3,
    },
    Threads: {
      style: "authentique et direct",
      structure: "Un post qui invite à la discussion, souvent sous la forme de courts paragraphes.",
      hashtagsCount: 5,
    },
  };

  const specifics = platformSpecifics[platform] || platformSpecifics["Instagram"];

  const prompt = `
Agis comme un créateur de contenu pour les réseaux sociaux. J'ai besoin que tu me crées un post pour ${platform}.

Je souhaite un post ${specifics.style} devant contenir :
- une légende engageante (en ${userProfile.language}) suivant cette structure : ${specifics.structure}
- une suggestion d'image en ${userProfile.language}
- une liste de ${specifics.hashtagsCount} hashtags spécifiques à ${platform}, optimisés pour un maximum d'engagement (en ${userProfile.language})
- un prompt d'image (en anglais) pour Midjourney, intégrant une description ultra-détaillée, avec des éléments précis comme le sujet principal, l'environnement, les émotions, les couleurs, les textures, les sources de lumière, les techniques artistiques, les mots-clés de style, ainsi que des détails techniques comme le type de caméra, d'objectif, et les techniques de post-traitement. Précise que l'image doit être extrêmement détaillée et parfaitement nette, mettant en valeur chaque élément avec une grande précision. **L'image ne doit contenir aucune écriture, aucun texte, ni aucun symbole.**

### Profil utilisateur :
- Activité : ${userProfile.activity}
- Introduction : ${userProfile.introduction}
- Langue : ${userProfile.language}
- Pays : ${userProfile.country}

### Structure des publications :
La réponse doit fournir le contenu structuré dans ce format :

{
  "content_calendar": [
    {
      "type": "${specifics.style}",
      "caption": "Légende en ${userProfile.language} suivant la structure : ${specifics.structure}",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3", "..."],
      "suggested_image": "Description en ${userProfile.language} de l'image",
      "image_prompt": {
        "description": "Une description ultra-détaillée en anglais pour Midjourney, précisant le sujet principal (ex. : un chat noir sur une table en bois), l'environnement (ex. : une pièce lumineuse avec des rideaux blancs), les émotions à transmettre (ex. : sérénité, nostalgie), les couleurs dominantes (ex. : tons chauds), les textures (ex. : bois lisse, fourrure douce), et les sources de lumière (ex. : lumière naturelle douce venant d'une fenêtre). **L'image ne doit contenir aucune écriture, aucun texte, ni aucun symbole.**",
        "style_keywords": ["mot-clé1", "mot-clé2", "mot-clé3"],
        "camera": "Modèle de caméra spécifique (ex. : Canon EOS 5D Mark IV)",
        "lens": "Type d'objectif (ex. : objectif 50mm f/1.4 pour une faible profondeur de champ)",
        "post_processing": "Techniques de post-traitement (ex. : rehaussement des contrastes, ajustement des tons, effet HDR léger)"
      }
    }
  ]
}

Renvoie uniquement l'objet JSON du post complet et structuré sans coupure.
`;




  console.log("prompt : ", prompt);

  // Appel à OpenAI pour générer les posts
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Tu es un assistant pour générer un post personnalisé pour les réseaux sociaux.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  // Parse la réponse JSON et extrait le contenu structuré
  const generatedContent = JSON.parse(response.data.choices[0].message.content);
  console.log("generatedContent 666 : ", generatedContent);

  // Vérifie que generatedContent est bien au format attendu
  if (!generatedContent || !generatedContent.content_calendar) {
    throw new Error("Le format de la réponse d'OpenAI n'est pas valide.");
  }

  // Crée les posts à enregistrer dans la base de données
  const generatedPosts = generatedContent.content_calendar.map((post: any) => ({
    userId,
    content: JSON.stringify(post),
  }));

  return generatedPosts;
};

// Vérifie les posts existants, génère les posts si nécessaire, puis les retourne
export const getOrGenerateMonthlyPosts = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params;
    let { socialNetwork } = req.params;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Vérifie l'abonnement actif de l'utilisateur
    const subscription = await SubscriptionModel.findOne({
      userId,
      active: true,
    });

    console.log("userId : ", userId);
    console.log("subscription : ", subscription);

    if (!subscription) {
      return res
        .status(403)
        .json({ message: "Vous n'avez pas d'abonnement actif." });
    }

    // Vérifie les posts existants pour le mois et l'année en cours
    const existingPosts = await PostModel.find({
      userId,
      month: currentMonth,
      year: currentYear,
    });

    if (existingPosts.length > 0) {
      return res.status(200).json(existingPosts);
    }// Liste des plateformes cibles

    const socialNetworks = ["Instagram", "Facebook", "Bluesky", "LinkedIn", "TikTok"];

    // Variable pour stocker tous les posts générés
    let allGeneratedPosts: any[] = [];

    // Parcourt chaque plateforme et génère les posts correspondants
    for (const socialNetwork of socialNetworks) {
      console.log(`Génération des posts pour ${socialNetwork}`);

      // Génère les posts pour le mois en cours via OpenAI
      const generatedPosts = await generateMonthlyPostsWithOpenAI(
        userId,
        currentMonth,
        currentYear,
        socialNetwork
      );

      // Ajoute la plateforme à chaque post généré
      const postsWithPlatform = generatedPosts.map((post: any) => ({
        ...post,
        platform: socialNetwork,
      }));

      // Ajoute les posts générés à la liste globale
      allGeneratedPosts = allGeneratedPosts.concat(postsWithPlatform);
    }

    // Sauvegarde tous les posts générés en base de données
    const savedPosts = await PostModel.insertMany(allGeneratedPosts);

    console.log("SAVED POSTS: ", savedPosts);

    // Retourne les posts nouvellement créés
    res.status(201).json(savedPosts);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération ou génération des posts :",
      error
    );
    res
      .status(500)
      .json({ message: "Erreur serveur, impossible de récupérer les posts." });
  }
};

// Vérifie les posts existants, génère les posts si nécessaire, puis les retourne
export const updateUniquePost = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params;
    const { postId } = req.params;
    const { platform } = req.params;

    // Vérifie l'abonnement actif de l'utilisateur
    const subscription = await SubscriptionModel.findOne({
      userId,
      active: true,
    });

    console.log("userId : ", userId);
    console.log("subscription : ", subscription);

    if (!subscription) {
      return res
        .status(403)
        .json({ message: "Vous n'avez pas d'abonnement actif." });
    }

    // Vérifie les posts existants pour le mois et l'année en cours
    const postToUpdate = await PostModel.findOne({
      _id: postId,
    });

    if (!postToUpdate) {
      return res.status(404).json("Post introuvable");
    }

    // Génère les posts pour le mois en cours via OpenAI
    const generatedPost = await generateONEPostsWithOpenAI(userId, platform);
    console.log("generatedPost (retour de fonction) : ", generatedPost);

    const updatedPost = await PostModel.findByIdAndUpdate(
      postId,
      { content: generatedPost[0].content },
      { new: true }
    );
    console.log("updatedPost : ", updatedPost);

    if (!updatedPost) {
      return res.status(404).json("Post introuvable");
    }
    updatedPost.content = JSON.parse(generatedPost[0].content);
    // Retourne les posts nouvellement créés
    res.status(201).json(updatedPost);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération ou génération des posts :",
      error
    );
    res
      .status(500)
      .json({ message: "Erreur serveur, impossible de récupérer les posts." });
  }
};

export const createUniquePost = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params;
    const { platform } = req.params;

    // Création de l'objet post
    let post: any = {};
    post.userId = userId;

    // Définition du mois et de l'année actuels
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // Mois actuel
    const currentYear = currentDate.getFullYear();  // Année actuelle

    // Garde le mois et l'année actuels si on est en décembre
    post.month = currentMonth;
    post.year = currentYear;


    // Génération du contenu via OpenAI
    let AIpost: any;
    try {
      AIpost = await generateONEPostsWithOpenAI(userId, platform);
      if (!AIpost || AIpost.length === 0) {
        return res.status(500).json({ message: "Erreur : aucun contenu généré par l'IA." });
      }
    } catch (error) {
      return res.status(500).json({ message: "Erreur lors de la génération du contenu avec l'IA." });
    }

    // Ajout du contenu généré au post
    post.content = AIpost[0].content || "";
    post.platform = platform || "Instagram"; // Plateforme par défaut
    post.imageUrl = ""; // À mettre à jour ultérieurement si nécessaire

    console.log("post 666 : ", post);

    // Création du nouveau post
    const newPost = new PostModel(post);
    console.log("newPost : ", newPost);

    // Sauvegarde du post en base de données
    await newPost.save();

    // Retourner une réponse de succès
    res.status(201).json({
      message: "Post créé avec succès.",
      post: newPost,
    });
  } catch (error) {
    console.error("Erreur : ", error);
    res.status(500).json({ message: "Impossible de créer le post." });
  }
};


async function updateImageFromDallE(post: any) {
  try {
    let prompt: any = JSON.parse(post.content).image_prompt;
    prompt = JSON.stringify(prompt);
    // Prépare la requête pour l'API DALL-E
    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        prompt,
        n: 1, // Nombre d'images à générer
        size: "1024x1024",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Récupère l'URL de l'image générée par DALL-E
    const imageUrl = response.data.data[0].url;

    // Télécharge l'image depuis l'URL et l'enregistre localement
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data, "binary");

    // Génère un nom de fichier aléatoire pour l'image
    const imageName = `izyGlow_image_${post._id}_${Date.now()}.png`;
    const imagePath = path.join(__dirname, "../../uploads/images", imageName);

    // Sauvegarde l'image dans le dossier local
    fs.writeFileSync(imagePath, imageBuffer);

    // Met à jour le post dans la base de données avec le chemin de l'image sauvegardée
    const updatedPost = await PostModel.findByIdAndUpdate(
      post._id,
      { imageUrl: `/uploads/images/${imageName}` },
      { new: true } // Pour retourner le document mis à jour
    );

    if (!updatedPost) {
      // Si le post n'existe pas, retourne une erreur
      return { message: "Post non trouvé.", code: 404 };
    }

    // Retourne la réponse de succès avec l'URL locale de l'image
    return {
      message: "Image générée, téléchargée et sauvegardée avec succès.",
      imageUrl: updatedPost.imageUrl, // URL de l'image locale
      post: updatedPost, // Document mis à jour du post
      code: 200,
    };
  } catch (error) {
    console.error("Erreur lors de l'envoi du prompt à DALL-E:", error);
    return {
      message: "Erreur serveur, impossible de générer l'image.",
      code: 500,
    };
  }
}

// Contrôleur pour améliorer un texte Instagram via OpenAI
export const improveInstagramPost = async (
  req: express.Request,
  res: express.Response
) => {
  const { postId } = req.params;
  const platform = req.body.platform;
  const text = req.body.text;
  const userId = req.body.userId;
  const type = req.body.type;

  console.log("body : ", req.body);
  console.log("text : ", text);
  console.log("userId : ", userId);
  console.log("type : ", type);
  if (!text) {
    return res.status(400).json({ message: "Texte à améliorer manquant." });
  }

  const userProfile = await ProfileModel.findOne({ userId, active: true });

  console.log("userProfile : ", userProfile);
  if (!userProfile) {
    return res.status(404).json({ message: "Profil non trouvé" });
  }
  console.log("userProfile.language : ", userProfile.language);
  // Crée un prompt pour améliorer le texte en gardant le sens mais en le rendant plus moderne et stylé pour Instagram
  const prompt = `
  Tu es un expert des réseaux sociaux, spécialisé en contenu pour ${platform}. Améliore le texte suivant.
  Ce texte est de type ${type}. Tu ne metteras pas de hashtags.
  Respect le but de l'auteur:
  Par exemple:
  - Si le texte a pour but d'être promotionel, améliore, cet aspect.
  - Si le texte a pour but d'être engageant, améliore cet aspect.
  - Si le texte a pour but d'être informatif, améliore cet aspect.
  - Si le texte a pour but d'être humoristique, améliore cet aspect.
  - Si le texte a pour but d'être décalé, améliore cet aspect.
  - etc...
  La langue du message devra être traduis dans cette langue: ${userProfile!.language
    }. 
  Tout en conservant le sens original. Utilise un ton accrocheur, dynamique et adapté aux réseaux sociaux.
  Assure-toi que le texte reste concis, et mets en avant l'idée centrale de manière percutante :

  Texte original : "${text}"

  Texte amélioré :
  `;

  console.log("Prompt pour améliorer le texte : ", prompt);

  try {
    // Appel à OpenAI pour améliorer le texte
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Tu es un assistant spécialisé dans l'amélioration de textes pour les réseaux sociaux.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Récupère le texte amélioré de la réponse d'OpenAI
    let improvedText = response.data.choices[0].message.content.trim();
    console.log("improvedText : ", improvedText);
    const postToUpdate = await PostModel.findOne({ _id: postId });
    if (!postToUpdate) {
      return res.status(404).json({ message: "Post introuvable" });
    }
    improvedText = improvedText.replace(/^"|"$/g, '');
    let content = JSON.parse(postToUpdate.content);
    content.caption = improvedText;
    content = JSON.stringify(content);
    const updatedPost = await PostModel.findByIdAndUpdate(
      postId,
      { content: content },
      { new: true }
    );
    // Renvoie le texte amélioré en réponse
    res.status(200).json({ original: text, improved: improvedText });
  } catch (error) {
    console.error("Erreur lors de l'amélioration du texte Instagram :", error);
    res
      .status(500)
      .json({ message: "Erreur serveur, impossible d'améliorer le texte." });
  }
};

// Fonction pour obtenir tous les posts d'un utilisateur
export const getAllPosts = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params;
    const posts = await PostModel.find({ userId });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Erreur lors de la récupération des posts :", error);
    res
      .status(500)
      .json({ message: "Erreur serveur, impossible de récupérer les posts." });
  }
};

// Fonction pour supprimer un post par ID
export const deletePostById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { postId } = req.params;
    const deletedPost = await PostModel.findByIdAndDelete(postId);
    if (!deletedPost) {
      return res.status(404).json({ message: "Post non trouvé." });
    }
    res.status(200).json({ message: "Post supprimé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression du post :", error);
    res
      .status(500)
      .json({ message: "Erreur serveur, impossible de supprimer le post." });
  }
};

// Fonction pour obtenir un post par ID
export const getPostById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { postId } = req.params;
    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post non trouvé." });
    }
    res.status(200).json(post);
  } catch (error) {
    console.error("Erreur lors de la récupération du post :", error);
    res
      .status(500)
      .json({ message: "Erreur serveur, impossible de récupérer le post." });
  }
};

// Fonction pour mettre à jour un post par ID
export const updatePostById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { postId } = req.params;
    const updatedPost = await PostModel.findByIdAndUpdate(
      { _id: postId },
      req.body,
      {
        new: true,
      }
    );
    if (!updatedPost) {
      return res.status(404).json({ message: "Post non trouvé." });
    }
    res.status(200).json(updatedPost);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du post :", error);
    res.status(500).json({
      message: "Erreur serveur, impossible de mettre à jour le post.",
    });
  }
};

// Génère une image avec DALL-E, télécharge l'image générée, l'enregistre localement et met à jour le post
export const sendPromptToDallE = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Récupère l'ID du post depuis les paramètres de la requête
    const { postId } = req.params;
    const referencePost = await PostModel.findById(postId);
    if (!referencePost) {
      return res.status(404).json({ message: "Post introuvable" });
    }

    console.log("POST ID : ", postId);

    let prompt: any = JSON.parse(referencePost.content).image_prompt;
// Nettoie le prompt avant l'envoi
const cleanPrompt = (data: any) => {
  if (typeof data === "object") {
    return JSON.stringify(data) // Convertit en string si c'est un objet
      .replace(/\s+/g, " ") // Supprime les espaces multiples
      .replace(/\\n|\\r/g, " ") // Supprime les retours à la ligne
      .trim(); // Supprime les espaces au début et à la fin
  } else if (typeof data === "string") {
    return data // Retourne directement si c'est déjà une chaîne
      .replace(/\s+/g, " ") // Supprime les espaces multiples
      .replace(/\\n|\\r/g, " ") // Supprime les retours à la ligne
      .trim(); // Supprime les espaces au début et à la fin
  }
  return data; // Retourne tel quel si ce n'est ni un objet ni une chaîne
};
prompt = prompt.description
// Utilisation
console.log(prompt);
console.log(typeof prompt)
    // Prépare la requête pour l'API DALL-E
    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        prompt,
        n: 1, // Nombre d'images à générer
        size: "1024x1024",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Récupère l'URL de l'image générée par DALL-E
    const imageUrl = response.data.data[0].url;

    // Télécharge l'image depuis l'URL et l'enregistre localement
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data, "binary");

    // Génère un nom de fichier aléatoire pour l'image
    const imageName = `izyGlow_image_${postId}_${Date.now()}.png`;
    const imagePath = path.join(__dirname, "../../uploads/images", imageName);

    // Sauvegarde l'image dans le dossier local
    fs.writeFileSync(imagePath, imageBuffer);

    // Met à jour le post dans la base de données avec le chemin de l'image sauvegardée
    const updatedPost = await PostModel.findByIdAndUpdate(
      postId,
      { imageUrl: `/uploads/images/${imageName}` },
      { new: true } // Pour retourner le document mis à jour
    );

    if (!updatedPost) {
      // Si le post n'existe pas, retourne une erreur
      return res.status(404).json({ message: "Post non trouvé." });
    }

    // Retourne la réponse de succès avec l'URL locale de l'image
    res.status(200).json({
      message: "Image générée, téléchargée et sauvegardée avec succès.",
      imageUrl: updatedPost.imageUrl, // URL de l'image locale
      post: updatedPost, // Document mis à jour du post
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi du prompt à DALL-E:", error);
    res
      .status(500)
      .json({ message: "Erreur serveur, impossible de générer l'image." });
  }
};


// Mise à jour de l'image URL pour un post
export const updatePostImageUrl = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { postId, imageUrl } = req.body;

    if (!postId || !imageUrl) {
      return res
        .status(400)
        .json({ message: "Le postId et imageUrl sont requis." });
    }

    // Mise à jour du post avec la nouvelle URL de l'image
    const updatedPost = await PostModel.findByIdAndUpdate(
      postId,
      { imageUrl }, // Mise à jour du champ imageUrl
      { new: true } // Renvoie le document mis à jour
    );

    if (!updatedPost) {
      return res.status(404).json({ message: "Post non trouvé." });
    }

    res.status(200).json({
      message: "URL de l'image mise à jour avec succès.",
      data: updatedPost,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'URL de l'image:", error);
    res.status(500).json({
      message: "Erreur serveur, impossible de mettre à jour l'URL de l'image.",
    });
  }
};

export default {
  createUniquePost,
  updateUniquePost,
  updateImageFromDallE,
  generateMonthlyPostsWithOpenAI,
  getOrGenerateMonthlyPosts,
  getAllPosts,
  deletePostById,
  updatePostById,
  getPostById,
  improveInstagramPost,
  sendPromptToDallE,
  updatePostImageUrl,
};
