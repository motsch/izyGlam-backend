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

// Génération des posts mensuels via OpenAI pour izyGlam
export const generateMonthlyPostsWithOpenAI = async (
  userId: string,
  month: number,
  year: number,
  socialNetwork: string
) => {
  // On garde la notion de profil actif si tu veux gérer des droits plus tard,
  // mais on ne se sert plus de ses champs pour construire le prompt.

  // Pour l'instant : fréquence fixe. Tu pourras la lier à l'abonnement ensuite.
  const publicationFrequency = 8;

  const socialNetworkLower = socialNetwork.toLowerCase();

  let networkInstructions = "";

  if (socialNetworkLower === "instagram") {
    networkInstructions = `
OBJECTIF POUR INSTAGRAM (izyGlam)
- Cible principale : prestataires beauté indépendants (esthéticiennes, coiffeuses à domicile, prothésistes ongulaires, coiffeurs à domicile, maquilleuses, etc.).
- But : leur donner envie de rejoindre et d'utiliser la plateforme izyGlam pour développer leur activité.
- Chaque post doit :
  - Mettre en avant la sécurité, la simplicité et la fiabilité d'izyGlam.
  - Expliquer comment izyGlam les aide à lancer ou structurer leur activité sans stress (gestion du planning, prise de rendez-vous en ligne, communication avec les clients, suivi des réservations, etc.).
  - Rassurer les prestataires qui débutent (peur de ne pas trouver de clients, peur de ne pas être légitimes, peur de la paperasse, peur de se lancer seules, etc.).
  - Donner des exemples concrets de situations du quotidien d'une prestataire à domicile et montrer comment izyGlam simplifie ces situations.
  - Inclure des appels à l'action clairs pour inciter à s'inscrire sur izyGlam, à créer son premier salon ou à visiter le site.
- Ton à privilégier : humain, chaleureux, bienveillant, motivant, très concret.
- Longueur des légendes : entre 80 et 150 mots, avec une mini histoire, un exemple précis ou un angle clair (pas de texte générique, pas de cliché).
`;
  } else if (socialNetworkLower === "linkedin") {
    networkInstructions = `
OBJECTIF POUR LINKEDIN (izyGlam)
- Cible principale : entreprises, services RH, CSE, dirigeants, hôtels, salles de sport, centres de bien-être, réseaux de franchises, etc.
- But : leur montrer pourquoi proposer izyGlam à leurs salariés ou à leurs clients est un levier intelligent de bien-être, d'expérience client et de marque employeur.
- Chaque post doit :
  - Expliquer la valeur business d'izyGlam : amélioration du bien-être au travail, réduction du stress, avantage salarié différenciant, fidélisation des talents, valorisation de la qualité de vie au travail, amélioration de l'expérience client, image de marque moderne et innovante.
  - Mettre en scène des cas concrets : par exemple un CSE qui propose des prestations beauté à domicile à tarif préférentiel pour les salariés, un hôtel qui offre l'accès à izyGlam à ses clients, une entreprise qui intègre izyGlam dans sa politique QVCT.
  - Structurer le texte comme un vrai post LinkedIn :
    1. Accroche forte en une à deux phrases qui interpellent la réalité du lecteur (RH, dirigeant, etc.).
    2. Développement avec arguments clairs, chiffres potentiels ou exemples concrets de mises en situation.
    3. Conclusion avec un appel à l'action explicite (demander une démo, prendre contact, en parler à son service RH, tester izyGlam pour un pilote, etc.).
  - Varier les angles : rétention des talents, réduction du stress, différenciation de la marque employeur, bénéfices pour les clients, innovation dans les avantages, etc.
- Ton à privilégier : professionnel, stratégique, sérieux mais accessible, avec une vraie profondeur de réflexion.
- Longueur des textes : entre 150 et 300 mots.
`;
  } else {
    networkInstructions = `
OBJECTIF GÉNÉRIQUE (izyGlam)
- Adapter le message au réseau social ${socialNetwork}.
- Toujours rester centré sur izyGlam, plateforme de mise en relation entre clients et prestataires beauté à domicile.
- Mettre en avant : sécurité, simplicité, outils pour structurer l'activité, valeur ajoutée pour les clients et pour les entreprises.
`;
  }

  const prompt = `
Tu es un expert senior en stratégie social media et en copywriting émotionnel pour la marque izyGlam.

QUI EST IZYGLAM
- izyGlam est une plateforme qui met en relation des clients et des prestataires beauté à domicile (coiffure, esthétique, maquillage, manucure, massages bien-être, etc.).
- La promesse d'izyGlam :
  - Aider les prestataires à se lancer et à structurer leur activité sans stress.
  - Offrir aux clients une expérience fluide, rassurante et qualitative.
  - Permettre aux entreprises de proposer des services de bien-être à domicile à leurs équipes ou à leurs clients.

OBJECTIF DE LA MISSION
- Tu dois générer un calendrier éditorial complet pour ${socialNetwork}, avec ${publicationFrequency} publications pour le mois ${month}/${year}.
- Le calendrier doit être pensé spécifiquement pour izyGlam, pas pour un autre type de business (pas de restaurant, pas d'exemples hors beauté à domicile).

CONTRAINTE DE LANGUE
- Tous les textes destinés à l'humain doivent être en français :
  - "caption"
  - "hashtags"
  - "suggested_image"
  - "image_prompt.style_keywords"
  - "image_prompt.camera"
  - "image_prompt.lens"
  - "image_prompt.post_processing"
- Seule exception : "image_prompt.description" doit être en anglais, car c'est un prompt pour Midjourney.
- Le français doit être naturel, fluide, précis et crédible, comme un véritable community manager expérimenté.

CONTRAINTE TYPOGRAPHIQUE
- N'utilise JAMAIS le caractère suivant : "–" (tiret moyen).
- Utilise UNIQUEMENT le tiret classique "-" si tu as besoin d'un tiret.
- Évite les symboles exotiques qui pourraient donner une impression de texte artificiel.

${networkInstructions}

CONTRAINTE QUALITÉ RÉDACTIONNELLE
- Chaque légende doit donner l'impression d'avoir été écrite par un humain expert en social media dans le domaine de la beauté et du bien-être.
- Les textes doivent être travaillés, nuancés, avec un vrai raisonnement marketing et psychologique :
  - peurs des prestataires (manque de clients, instabilité, peur de se lancer),
  - désirs (liberté, clients réguliers, image professionnelle),
  - objections (peur de la technologie, peur de la plateforme),
  - bénéfices concrets (gain de temps, meilleure organisation, visibilité).
- Varie les accroches, les structures de phrase, le vocabulaire et les appels à l'action.
- Évite les formulations génériques ou plates (par exemple : "Voici quelques conseils" ou "Dans cet article, nous allons...").
- N'écris jamais "en tant qu'IA" ou quoi que ce soit qui laisse penser que le texte est généré automatiquement.
- Utilise le nom izyGlam quand c'est pertinent, sans le sur-utiliser dans toutes les phrases.

SPÉCIFICITÉ À MENTIONNER DANS ENVIRON 10 POUR CENT DES POSTS
- Certains posts (environ 10 pour cent) doivent mettre en avant une spécificité ou un exemple concret de prestataire utilisant izyGlam (par exemple : "une esthéticienne qui se lance à domicile grâce à izyGlam", "une coiffeuse à domicile qui structure son planning grâce à izyGlam").
- Ces posts doivent rester réalistes, crédibles et inspirants.

CONTRAINTE FORMAT & JSON
Tu dois renvoyer STRICTEMENT un objet JSON valide, sans aucun texte avant ou après.
- Utilise uniquement des doubles guillemets " pour toutes les clés et toutes les valeurs de type string.
- Ne rajoute aucun commentaire.
- Respecte exactement cette structure :

{
  "content_calendar": [
    {
      "type": "ton. ex: engaging",
      "date": "date idéale de publication pour le mois de ${month}",
      "heure": "heure de publication idéale pour ce post au format HH:MM",
      "caption": "Texte du post en français, sur le ton désiré.",
      "hashtags": ["hashtag_en_francais", "autre_hashtag", "izyglam"],
      "suggested_image": "Description de l'image, en français.",
      "image_prompt": {
        "description": "Description en anglais pour Midjourney",
        "style_keywords": ["mot-clé en français", "mot-clé en français", "mot-clé en français"],
        "camera": "Modèle de caméra (en français)",
        "lens": "Type d'objectif (en français)",
        "post_processing": "Techniques de post-traitement (en français)"
      }
    }
  ]
}

Génère ${publicationFrequency} objets dans "content_calendar".
Adapte le contenu de chaque post à l'objectif précis de ${socialNetwork} décrit plus haut et au mois ${month}/${year}.
Tout doit être cohérent avec l'univers d'izyGlam et la beauté à domicile, jamais avec un autre univers comme la restauration.
`;

  console.log("prompt : ", prompt);

  const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

  const supportsResponseFormat =
    MODEL.startsWith("gpt-4.1") ||
    MODEL.startsWith("gpt-4o") ||
    MODEL.startsWith("gpt-5");

  const openAiBody: any = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Tu es un assistant expert en stratégie social media pour izyGlam. Tu renvoies toujours UNIQUEMENT un JSON valide respectant strictement la structure demandée.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.85,
  };

  if (supportsResponseFormat) {
    openAiBody.response_format = { type: "json_object" };
  }

  let rawContent: string;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      openAiBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    rawContent = response.data.choices[0].message.content;
  } catch (error: any) {
    console.error("Erreur lors de l'appel OpenAI :", {
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw new Error(
      `Erreur OpenAI (${error?.response?.status || "unknown"}). Regarde les logs pour plus de détails.`
    );
  }

  let generatedContent: any;
  try {
    generatedContent = JSON.parse(rawContent);
  } catch (error) {
    console.error("Erreur de parsing JSON OpenAI :", error, rawContent);
    throw new Error(
      "Le JSON renvoyé par OpenAI est invalide. Contenu brut loggé côté serveur."
    );
  }

  if (
    !generatedContent ||
    !generatedContent.content_calendar ||
    !Array.isArray(generatedContent.content_calendar)
  ) {
    console.error("Réponse OpenAI mal formatée :", generatedContent);
    throw new Error("Le format de la réponse d'OpenAI n'est pas valide.");
  }

  const generatedPosts = generatedContent.content_calendar.map((post: any) => ({
    userId,
    month,
    year,
    content: JSON.stringify(post),
  }));

  return generatedPosts;
};

// Génération d'un post unique (update dans la table)
export const generateONEPostsWithOpenAI = async (
  userId: string,
  platform: string
) => {
  // On garde la vérification du profil (logique de permissions / abonnement potentielle)
  const userProfile = await ProfileModel.findOne({ userId, active: true });
  if (!userProfile) {
    throw new Error("Profil actif non trouvé pour cet utilisateur.");
  }
  console.log(
    "userProfile trouvé (non utilisé pour le contenu, seulement pour le contexte izyGlam) : ",
    userProfile
  );

  const socialNetworkLower = platform.toLowerCase();

  let networkInstructions = "";

  if (socialNetworkLower === "instagram") {
    networkInstructions = `
OBJECTIF POUR INSTAGRAM (izyGlam)
- Cible principale : prestataires beauté indépendants (esthéticiennes, coiffeuses à domicile, prothésistes ongulaires, coiffeurs à domicile, maquilleuses, etc.).
- But : leur donner envie de rejoindre et d'utiliser la plateforme izyGlam pour développer leur activité.
- Le post doit :
  - Mettre en avant la sécurité, la simplicité et la fiabilité d'izyGlam.
  - Expliquer comment izyGlam les aide à lancer ou structurer leur activité sans stress (gestion du planning, prise de rendez-vous en ligne, communication avec les clients, suivi des réservations, etc.).
  - Rassurer les prestataires qui débutent (peur de ne pas trouver de clients, peur de ne pas être légitimes, peur de la paperasse, peur de se lancer seules, etc.).
  - Donner un exemple concret d'une situation du quotidien d'une prestataire à domicile et montrer comment izyGlam simplifie cette situation.
  - Inclure un appel à l'action clair pour inciter à s'inscrire sur izyGlam, à créer son premier salon ou à visiter le site.
- Ton à privilégier : humain, chaleureux, bienveillant, motivant, très concret.
- Longueur de la légende : entre 80 et 150 mots, avec une mini histoire, un exemple précis ou un angle clair (pas de texte générique, pas de cliché).
`;
  } else if (socialNetworkLower === "linkedin") {
    networkInstructions = `
OBJECTIF POUR LINKEDIN (izyGlam)
- Cible principale : entreprises, services RH, CSE, dirigeants, hôtels, salles de sport, centres de bien-être, réseaux de franchises, etc.
- But : leur montrer pourquoi proposer izyGlam à leurs salariés ou à leurs clients est un levier intelligent de bien-être, d'expérience client et de marque employeur.
- Le post doit :
  - Expliquer la valeur business d'izyGlam : amélioration du bien-être au travail, réduction du stress, avantage salarié différenciant, fidélisation des talents, valorisation de la qualité de vie au travail, amélioration de l'expérience client, image de marque moderne et innovante.
  - Mettre en scène un cas concret : par exemple un CSE qui propose des prestations beauté à domicile à tarif préférentiel pour les salariés, un hôtel qui offre l'accès à izyGlam à ses clients, une entreprise qui intègre izyGlam dans sa politique QVCT.
  - Structurer le texte comme un vrai post LinkedIn :
    1. Accroche forte en une à deux phrases qui interpellent la réalité du lecteur (RH, dirigeant, etc.).
    2. Développement avec arguments clairs, quelques chiffres ou exemples concrets de mise en situation.
    3. Conclusion avec un appel à l'action explicite (demander une démo, prendre contact, en parler à son service RH, tester izyGlam pour un pilote, etc.).
  - Choisir un angle précis (rétention des talents, réduction du stress, différenciation de la marque employeur, bénéfices pour les clients, innovation dans les avantages, etc.).
- Ton à privilégier : professionnel, stratégique, sérieux mais accessible, avec une vraie profondeur de réflexion.
- Longueur du texte : entre 150 et 300 mots.
`;
  } else {
    networkInstructions = `
OBJECTIF GÉNÉRIQUE (izyGlam)
- Adapter le message au réseau social ${platform}.
- Toujours rester centré sur izyGlam, plateforme de mise en relation entre clients et prestataires beauté à domicile.
- Mettre en avant : sécurité, simplicité, outils pour structurer l'activité, valeur ajoutée pour les clients et pour les entreprises.
`;
  }

  const prompt = `
Tu es un expert senior en stratégie social media et en copywriting émotionnel pour la marque izyGlam.

QUI EST IZYGLAM
- izyGlam est une plateforme qui met en relation des clients et des prestataires beauté à domicile (coiffure, esthétique, maquillage, manucure, massages bien-être, etc.).
- La promesse d'izyGlam :
  - Aider les prestataires à se lancer et à structurer leur activité sans stress.
  - Offrir aux clients une expérience fluide, rassurante et qualitative.
  - Permettre aux entreprises de proposer des services de bien-être à domicile à leurs équipes ou à leurs clients.

OBJECTIF DE LA MISSION
- Tu dois générer UN SEUL post pour la plateforme ${platform}.
- Le post doit être pensé spécifiquement pour izyGlam, pas pour un autre type de business (pas de restaurant, pas d'exemples hors beauté à domicile).

CONTRAINTE DE LANGUE
- Tous les textes destinés à l'humain doivent être en français :
  - "caption"
  - "hashtags"
  - "suggested_image"
  - "image_prompt.style_keywords"
  - "image_prompt.camera"
  - "image_prompt.lens"
  - "image_prompt.post_processing"
- Seule exception : "image_prompt.description" doit être en anglais, car c'est un prompt pour Midjourney.
- Le français doit être naturel, fluide, précis et crédible, comme un véritable community manager expérimenté.

CONTRAINTE TYPOGRAPHIQUE
- N'utilise JAMAIS le caractère suivant : "–" (tiret moyen).
- Utilise UNIQUEMENT le tiret classique "-" si tu as besoin d'un tiret.
- Évite les symboles exotiques qui pourraient donner une impression de texte artificiel.

${networkInstructions}

CONTRAINTE QUALITÉ RÉDACTIONNELLE
- La légende doit donner l'impression d'avoir été écrite par un humain expert en social media dans le domaine de la beauté et du bien-être.
- Le texte doit être travaillé, nuancé, avec un vrai raisonnement marketing et psychologique :
  - peurs des prestataires (manque de clients, instabilité, peur de se lancer),
  - désirs (liberté, clients réguliers, image professionnelle),
  - objections (peur de la technologie, peur de la plateforme),
  - bénéfices concrets (gain de temps, meilleure organisation, visibilité).
- Varie les accroches, les structures de phrase, le vocabulaire et les appels à l'action.
- Évite les formulations génériques ou plates (par exemple : "Voici quelques conseils" ou "Dans cet article, nous allons...").
- N'écris jamais "en tant qu'IA" ou quoi que ce soit qui laisse penser que le texte est généré automatiquement.
- Utilise le nom izyGlam quand c'est pertinent, sans le sur-utiliser dans toutes les phrases.

SPÉCIFICITÉ OPTIONNELLE
- Tu peux, si c'est pertinent, illustrer le post avec un exemple concret de prestataire utilisant izyGlam (par exemple : "une esthéticienne qui se lance à domicile grâce à izyGlam", "une coiffeuse à domicile qui structure son planning grâce à izyGlam").
- Le post doit rester réaliste, crédible et inspirant.

CONTRAINTE FORMAT & JSON
Tu dois renvoyer STRICTEMENT un objet JSON valide, sans aucun texte avant ou après.
- Utilise uniquement des doubles guillemets " pour toutes les clés et toutes les valeurs de type string.
- Ne rajoute aucun commentaire.
- Respecte exactement cette structure :

{
  "content_calendar": [
    {
      "type": "type de ton, par exemple engaging, inspirant, éducatif, etc.",
      "date": "une date de publication plausible (format libre, par exemple 2025-11-23)",
      "heure": "une heure de publication idéale pour ce post au format HH:MM",
      "caption": "Texte du post en français, sur le ton choisi.",
      "hashtags": ["hashtag_en_francais", "autre_hashtag", "izyglam"],
      "suggested_image": "Description de l'image, en français.",
      "image_prompt": {
        "description": "Description en anglais pour Midjourney, sans texte ni symbole dans l'image.",
        "style_keywords": ["mot-clé en français", "mot-clé en français", "mot-clé en français"],
        "camera": "Modèle de caméra (en français)",
        "lens": "Type d'objectif (en français)",
        "post_processing": "Techniques de post-traitement (en français)"
      }
    }
  ]
}

Génère EXACTEMENT 1 objet dans "content_calendar".
Tout doit être cohérent avec l'univers d'izyGlam et la beauté à domicile, jamais avec un autre univers comme la restauration.
`;

  console.log("prompt (ONE post) : ", prompt);

  const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

  const supportsResponseFormat =
    MODEL.startsWith("gpt-4.1") ||
    MODEL.startsWith("gpt-4o") ||
    MODEL.startsWith("gpt-5");

  const openAiBody: any = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Tu es un assistant expert en stratégie social media pour izyGlam. Tu renvoies toujours UNIQUEMENT un JSON valide respectant strictement la structure demandée.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 2000,
    temperature: 0.85,
  };

  if (supportsResponseFormat) {
    openAiBody.response_format = { type: "json_object" };
  }

  let rawContent: string;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      openAiBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    rawContent = response.data.choices[0].message.content;
  } catch (error: any) {
    console.error("Erreur lors de l'appel OpenAI (ONE post) :", {
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw new Error(
      `Erreur OpenAI (${error?.response?.status || "unknown"}). Regarde les logs pour plus de détails.`
    );
  }

  let generatedContent: any;
  try {
    generatedContent = JSON.parse(rawContent);
  } catch (error) {
    console.error("Erreur de parsing JSON OpenAI (ONE post) :", error, rawContent);
    throw new Error(
      "Le JSON renvoyé par OpenAI est invalide. Contenu brut loggé côté serveur."
    );
  }

  if (
    !generatedContent ||
    !generatedContent.content_calendar ||
    !Array.isArray(generatedContent.content_calendar)
  ) {
    console.error("Réponse OpenAI mal formatée (ONE post) :", generatedContent);
    throw new Error("Le format de la réponse d'OpenAI n'est pas valide.");
  }

  // On s'attend à 1 seul objet, mais on map quand même pour rester cohérent avec ton code existant
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

    // Vérifie les posts existants pour le mois et l'année en cours
    const existingPosts = await PostModel.find({
      userId,
      month: currentMonth,
      year: currentYear,
    });

    if (existingPosts.length > 0) {
      return res.status(200).json(existingPosts);
    }// Liste des plateformes cibles

    const socialNetworks = ["Instagram", "LinkedIn"];

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

// Fonction pour obtenir tous les posts d'un utilisateur avec status "pending"
export const getAllPosts = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params;

    // On filtre par userId + status = 'pending'
    const posts = await PostModel.find({
      userId,
      status: 'pending'
    });

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

// Génère des images pour une multitude de posts
export const sendPromptsToDallE = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { postIds } = req.body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        message: "Le champ 'postIds' doit être un tableau non vide.",
      });
    }

    const results: {
      postId: string;
      success: boolean;
      imageUrl?: string;
      post?: any;
      error?: string;
    }[] = [];

    // Traitement séquentiel (plus simple / limite la casse niveau rate limit)
    for (const postId of postIds) {
      try {
        const result = await generateImageForPost(postId);
        results.push({
          postId,
          success: true,
          imageUrl: result.imageUrl,
          post: result.post,
        });
      } catch (err: any) {
        console.error(`Erreur pour le post ${postId} :`, err);
        results.push({
          postId,
          success: false,
          error: err?.message || "Erreur inconnue",
        });
      }
    }

    res.status(200).json({
      message: "Traitement terminé.",
      results, // tableau avec success/error pour chaque post
    });
  } catch (error) {
    console.error(
      "Erreur lors de la génération des images pour plusieurs posts :",
      error
    );
    res.status(500).json({
      message:
        "Erreur serveur, impossible de générer les images pour plusieurs posts.",
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

// Fonction utilitaire interne pour générer une image pour un post
// Fonction utilitaire interne pour générer une image pour un post
const generateImageForPost = async (postId: string) => {
  const referencePost = await PostModel.findById(postId);
  if (!referencePost) {
    throw new Error("Post introuvable");
  }

  console.log("POST ID : ", postId);

  // Récupération du prompt
  let prompt: any = JSON.parse(referencePost.content).image_prompt;
  prompt = prompt.description;

  console.log("PROMPT UTILISÉ :", prompt);

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "gpt-image-1", // ou "dall-e-2" selon ce que tu utilises
        prompt,
        n: 1,
        size: "1024x1024",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // 🔍 Sécurisation de la récupération de l'output
    const imageData = response.data?.data?.[0];
    if (!imageData) {
      console.error("Réponse OpenAI inattendue :", response.data);
      throw new Error("Réponse OpenAI invalide : data[0] manquant.");
    }

    // On log juste les clés pour debug léger
    console.log("Clés retournées par OpenAI pour data[0] :", Object.keys(imageData));

    let imageBuffer: Buffer;

    if (imageData.url) {
      // ✅ Cas URL classique
      const imageUrl = imageData.url;
      console.log("Image URL retournée par OpenAI :", imageUrl);

      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      imageBuffer = Buffer.from(imageResponse.data, "binary");
    } else if (imageData.b64_json) {
      // ✅ Cas base64 (aucun GET nécessaire)
      console.log("Image retournée en base64 (b64_json)");
      imageBuffer = Buffer.from(imageData.b64_json, "base64");
    } else {
      console.error("Ni url ni b64_json dans la réponse OpenAI :", imageData);
      throw new Error("Réponse OpenAI sans url ni b64_json.");
    }

    // Nom de fichier
    const imageName = `izyGlow_image_${postId}_${Date.now()}.png`;
    const imagePath = path.join(__dirname, "../../uploads/images", imageName);

    // Sauvegarde locale
    fs.writeFileSync(imagePath, imageBuffer);

    // Mise à jour du post
    const updatedPost = await PostModel.findByIdAndUpdate(
      postId,
      { imageUrl: `/uploads/images/${imageName}` },
      { new: true }
    );

    if (!updatedPost) {
      throw new Error("Post non trouvé après mise à jour");
    }

    return {
      postId,
      imageUrl: updatedPost.imageUrl,
      post: updatedPost,
    };
  } catch (err: any) {
    console.error(
      `Erreur OpenAI pour le post ${postId} :`,
      err?.response?.data || err.message || err
    );
    throw new Error(
      err?.response?.data?.error?.message ||
        "Erreur lors de l'appel à l'API d'images."
    );
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
  generateImageForPost,
  sendPromptToDallE,
  sendPromptsToDallE,
  updatePostImageUrl,
};
