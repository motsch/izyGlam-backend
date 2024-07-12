#!/bin/bash

# Configuration du backend Node.js Express
backend_command="nohup npx nodemon &"
backend_log_file="nohup.out"

# Configuration de MongoDB
mongodb_gpg_key="/usr/share/keyrings/mongodb-server-7.0.gpg"
mongodb_list_file="/etc/apt/sources.list.d/mongodb-org-7.0.list"

# Fonction pour afficher un message informatif
info() {
    echo -e "\e[92m[INFO]\e[0m $1"
}

# Fonction pour afficher un message d'erreur et quitter le script
error() {
    echo -e "\e[91m[ERROR]\e[0m $1"
    exit 1
}

# Fonction pour vérifier l'exécution d'une commande et afficher un message approprié
check_command() {
    if [ $? -eq 0 ]; then
        info "$1 exécutée avec succès."
    else
        error "$1 a échoué. Veuillez vérifier et corriger le problème avant de continuer."
    fi
}

# Backend Node.js Express
info "Exécution du backend Node.js Express..."
$backend_command
check_command "Backend Node.js Express"

# Vérification de la sortie du fichier nohup.out
info "Vérification de la sortie du backend..."
cat $backend_log_file

# MongoDB
info "Installation de MongoDB Community Edition sur Ubuntu 22.04 LTS (Jammy)..."
sudo apt-get install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o $mongodb_gpg_key --dearmor
check_command "Importation de la clé publique"

echo "deb [ arch=amd64,arm64 signed-by=$mongodb_gpg_key ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee $mongodb_list_file
check_command "Création du fichier de liste pour MongoDB"

sudo apt-get update
check_command "Rechargement de la base de données locale des paquets"

sudo apt-get install -y mongodb-org
check_command "Installation de la dernière version stable de MongoDB"

info "Gestion du démarrage et de l'arrêt de MongoDB avec Systemd..."
sudo systemctl start mongod
check_command "Démarrage de MongoDB"

sudo systemctl status mongod
check_command "Vérification du statut de MongoDB"

sudo systemctl enable mongod
check_command "Activation du démarrage automatique au démarrage du système"

sudo systemctl stop mongod
check_command "Arrêt de MongoDB"

sudo systemctl restart mongod
check_command "Redémarrage de MongoDB"

#info "Vérifiez l'installation et commencez à utiliser MongoDB avec la commande 'mongosh'."

#info "Désinstallation de MongoDB Community Edition (optionnel)..."
#sudo systemctl stop mongod
#check_command "Arrêt de MongoDB avant la désinstallation"

#sudo apt-get purge mongodb-org*
#check_command "Suppression des paquets MongoDB"

#sudo rm -r /var/log/mongodb
#sudo rm -r /var/lib/mongodb
#check_command "Suppression des répertoires de données et de journaux MongoDB"

info "Le script a été exécuté avec succès."
