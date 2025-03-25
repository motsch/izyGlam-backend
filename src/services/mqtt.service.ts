import mqtt from 'mqtt';
import mongoose from 'mongoose';
import AdvertisementModel from '../models/advertisement';
import shopModel from '../models/shop';
import ConversationModel from '../models/conversation';

class MqttService {
    private client: mqtt.MqttClient;
    private brokerUrl = 'mqtt://0.0.0.0:1883'; // Change avec ton adresse MQTT
    private username = 'fmotsch'; // Met les identifiants de RabbitMQ si besoin
    private password = 'Fr@ncis2018!';
    private pubImpressionQueue: { pubId: string; count: number }[] = []; // Buffer d'impressions pub
    private shopImpressionQueue: { shopId: string; count: number }[] = []; // Buffer d'impressions pub
    private updateInterval = 5 * 60 * 1000; // Toutes les 5 minutes
    private pubClickQueue: { pubId: string; count: number }[] = [];
    private shopClickQueue: { shopId: string; count: number }[] = [];

    constructor() {
        this.client = mqtt.connect(this.brokerUrl, {
            username: this.username,
            password: this.password,
        });

        this.client.on('connect', () => {
            console.log('✅ Connecté à MQTT');
            this.client.subscribe('pub/impression', (err) => {
                if (err) console.error('❌ Erreur de souscription MQTT:', err);
                else console.log('📡 Abonné au topic pub/impression');
            });
            this.client.subscribe('shop/impression', (err) => {
                if (err) console.error('❌ Erreur de souscription MQTT:', err);
                else console.log('📡 Abonné au topic pub/impression');
            });

            // Abonnement aux clics
            this.client.subscribe('pub/click', (err) => {
                if (err) console.error('❌ Erreur de souscription MQTT:', err);
                else console.log('📡 Abonné au topic pub/click');
            });

            // Abonnement aux clics
            this.client.subscribe('shop/click', (err) => {
                if (err) console.error('❌ Erreur de souscription MQTT:', err);
                else console.log('📡 Abonné au topic pub/click');
            });

            this.client.subscribe('conversation/+/new', (err) => {
                if (err) console.error('❌ Erreur de souscription MQTT (conversation):', err);
                else console.log('📡 Abonné à conversation/+/new');
            });
        });

        this.client.on('message', (topic, message) => this.handleMessage(topic, message));

        this.client.on('error', (err) => {
            console.error('❌ Erreur MQTT:', err);
        });

        // Toutes les 5 minutes, envoie les mises à jour à MongoDB
        setInterval(() => this.updatePubImpressionsBatch(), this.updateInterval);

        // Toutes les 5 minutes, envoie les mises à jour à MongoDB
        setInterval(() => this.updateShopImpressionsBatch(), this.updateInterval);

        // Exécution de la mise à jour en batch toutes les 5 minutes
        setInterval(() => this.updatePubClicksBatch(), this.updateInterval);

        // Exécution de la mise à jour en batch toutes les 5 minutes
        setInterval(() => this.updateShopClicksBatch(), this.updateInterval);
    }

    // ⚡ Fonction pour stocker les impressions en mémoire
    private async handleMessage(topic: string, message: Buffer) {
        if (topic === 'pub/impression') {
            try {
                const { pubId } = JSON.parse(message.toString());

                // Vérifie si la pub est déjà dans la file
                const existing = this.pubImpressionQueue.find((item) => item.pubId === pubId);
                if (existing) {
                    existing.count += 1;
                } else {
                    this.pubImpressionQueue.push({ pubId, count: 1 });
                }
            } catch (error) {
                console.error('❌ Erreur parsing MQTT message:', error);
            }
        } else if (topic === 'shop/impression') {
            try {
                const { shopId } = JSON.parse(message.toString());

                // Vérifie si la pub est déjà dans la file
                const existing = this.shopImpressionQueue.find((item) => item.shopId === shopId);
                if (existing) {
                    existing.count += 1;
                } else {
                    this.shopImpressionQueue.push({ shopId, count: 1 });
                }
            } catch (error) {
                console.error('❌ Erreur parsing MQTT message:', error);
            }
        } else if (topic === 'pub/click') {
            try {
                const { pubId } = JSON.parse(message.toString());

                // Vérifie si la pub est déjà dans le buffer
                const existing = this.pubClickQueue.find((item) => item.pubId === pubId);
                if (existing) {
                    existing.count += 1;
                } else {
                    this.pubClickQueue.push({ pubId, count: 1 });
                }
            } catch (error) {
                console.error('❌ Erreur parsing MQTT message:', error);
            }
        } else if (topic === 'shop/click') {
            try {
                const { shopId } = JSON.parse(message.toString());

                // Vérifie si la pub est déjà dans le buffer
                const existing = this.shopClickQueue.find((item) => item.shopId === shopId);
                if (existing) {
                    existing.count += 1;
                } else {
                    this.shopClickQueue.push({ shopId, count: 1 });
                }
            } catch (error) {
                console.error('❌ Erreur parsing MQTT message:', error);
            }
        } else if (topic.startsWith('conversation/') && topic.endsWith('/new')) {
            const parts = topic.split('/');
            const conversationId = parts[1];

            try {
                const msg = JSON.parse(message.toString());

                const conversation = await ConversationModel.findById(conversationId);
                if (!conversation) {
                    console.warn(`❌ Conversation non trouvée: ${conversationId}`);
                    return;
                }

                conversation.messages.push({
                    sender: msg.sender,
                    content: msg.content,
                    messageType: msg.messageType || 'text',
                    createdAt: new Date(),
                });

                await conversation.save();

                // Broadcast aux abonnés du topic conversation/{id}
                this.client.publish(`conversation/${conversationId}`, JSON.stringify(conversation.messages));
                console.log(`💬 Nouveau message publié dans conversation/${conversationId}`);
            } catch (error) {
                console.error('❌ Erreur traitement message de conversation:', error);
            }
        }
    }

    // 🔥 Fonction pour mettre à jour MongoDB en batch
    private async updatePubImpressionsBatch() {
        if (this.pubImpressionQueue.length === 0) {
            console.log('⏳ Aucun message MQTT à traiter.');
            return;
        }

        console.log(`🚀 Mise à jour en batch de ${this.pubImpressionQueue.length} pubs...`);

        try {
            const bulkOps = this.pubImpressionQueue.map(({ pubId, count }) => ({
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(pubId) },
                    update: { $inc: { impressions: count } },
                },
            }));

            await AdvertisementModel.bulkWrite(bulkOps);
            console.log('✅ Mise à jour MongoDB PUB IMPRESSION terminée.');
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour en batch:', error);
        } finally {
            // Réinitialise le buffer
            this.pubImpressionQueue = [];
        }
    }

    // 🔥 Fonction pour mettre à jour MongoDB en batch
    private async updateShopImpressionsBatch() {
        if (this.shopImpressionQueue.length === 0) {
            console.log('⏳ Aucun message MQTT à traiter.');
            return;
        }

        console.log(`🚀 Mise à jour en batch de ${this.shopImpressionQueue.length} pubs...`);

        try {
            const bulkOps = this.shopImpressionQueue.map(({ shopId, count }) => ({
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(shopId) },
                    update: { $inc: { impressions: count } },
                },
            }));

            await shopModel.bulkWrite(bulkOps);
            console.log('✅ Mise à jour MongoDB SHOP IMPRESSION terminée.');
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour en batch:', error);
        } finally {
            // Réinitialise le buffer
            this.shopImpressionQueue = [];
        }
    }

    // 🔥 Mise à jour des clics en batch avec taux_conversion
    private async updatePubClicksBatch() {
        if (this.pubClickQueue.length === 0) {
            console.log('⏳ Aucun clic MQTT à traiter.');
            return;
        }

        console.log(`🚀 Mise à jour en batch de ${this.pubClickQueue.length} pubs...`);

        try {
            const bulkOps = await Promise.all(
                this.pubClickQueue.map(async ({ pubId, count }) => {
                    const ad = await AdvertisementModel.findById(pubId);
                    if (!ad) return null; // Si la pub n'existe pas, on l'ignore

                    const newClicks = ad.clics + count;
                    const newTauxConversion = ad.impressions > 0 ? (newClicks / ad.impressions) * 100 : 0;

                    return {
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(pubId) },
                            update: { $inc: { clics: count }, $set: { taux_conversion: newTauxConversion } }
                        }
                    };
                })
            );

            await AdvertisementModel.bulkWrite(bulkOps.filter(op => op !== null));
            console.log('✅ Mise à jour MongoDB PUB CLICKS + TAUX_CONVERSION terminée.');
        } catch (error) {
            console.error('❌ Erreur batch clics:', error);
        } finally {
            this.pubClickQueue = [];
        }
    }



    // 🔥 Mise à jour des clics en batch avec taux_conversion
    private async updateShopClicksBatch() {
        if (this.shopClickQueue.length === 0) {
            console.log('⏳ Aucun clic MQTT à traiter.');
            return;
        }

        console.log(`🚀 Mise à jour en batch de ${this.shopClickQueue.length} pubs...`);

        try {
            const bulkOps = await Promise.all(
                this.shopClickQueue.map(async ({ shopId, count }) => {
                    const shop = await shopModel.findById(shopId);
                    if (!shop) return null; // Si la pub n'existe pas, on l'ignore

                    const newClicks = shop.clics + count;
                    const newTauxConversion = shop.impressions > 0 ? (newClicks / shop.impressions) * 100 : 0;

                    return {
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(shopId) },
                            update: { $inc: { clics: count }, $set: { taux_conversion: newTauxConversion } }
                        }
                    };
                })
            );

            await shopModel.bulkWrite(bulkOps.filter(op => op !== null));
            console.log('✅ Mise à jour MongoDB PUB CLICKS + TAUX_CONVERSION terminée.');
        } catch (error) {
            console.error('❌ Erreur batch clics:', error);
        } finally {
            this.pubClickQueue = [];
        }
    }
}

// Initialise le service MQTT
export default new MqttService();
