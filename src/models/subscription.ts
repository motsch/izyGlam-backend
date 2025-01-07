import mongoose from "mongoose";

// Interface définissant la structure d'un document Subscription
export interface iSubscription extends mongoose.Document {
  userId: string;
  startDate: Date;
  endDate: Date;
  active: boolean;
  planType: string;
  isExpired(): boolean;
}

// Schéma Mongoose pour le modèle Subscription
const subscriptionSchema = new mongoose.Schema<iSubscription>({
  userId: { 
    type: String, 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  active: { 
    type: Boolean, 
    required: true, 
    default: true 
  },
  planType: { 
    type: String, 
    enum: ["basic", "premium", "pro"], 
    required: true 
  },
});

// Méthode pour vérifier si l'abonnement est expiré
subscriptionSchema.methods.isExpired = function() {
  return this.endDate < new Date();
};

// Middleware pour mettre à jour automatiquement le statut actif
subscriptionSchema.pre("save", function(next) {
  this.active = !this.isExpired();
  next();
});

// Création du modèle Subscription basé sur le schéma
const SubscriptionModel = mongoose.model<iSubscription>("Subscription", subscriptionSchema);
export default SubscriptionModel;
