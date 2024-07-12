export default {
  definition: {
    openapi: "3.0.1",
    info: {
      version: "1.0.0",
      title: "DeveloppeurFreelance  - API",
      description: "..............",
      termsOfService: "",
      contact: {
        name: "DeveloppeurFreelance Support",
        email: "info@developpeurfreelance.com",
        url: "https://www.developpeurfreelance.com",
      },
      license: {
        name: "Apache 2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0.html",
      },
    },
    servers: [
      {
        url: "/api",
        description: "Current API",
      },
    ],
    tags: [
      {
        name: "Actuators",
        description: "API permettant de récupérer les IoTs et leurs états",
      },
      {
        name: "Admin",
        description:
          "API permettant de manager les configs d'administration de l'application",
      },
      {
        name: "Allee",
        description: "API permettant de gérer les allées",
      },
      {
        name: "Articles",
        description: "API permettant de gérer les articles",
      },
      {
        name: "Bosch configs",
        description:
          "API permettant de gérer les configurations des serveurs bosch et IRIIS",
      },
      {
        name: "Columns",
        description: "API permettant de gérer les colonnes du kanban",
      },
      {
        name: "Dashboard",
        description: "API permettant de gérer les KPI",
      },
      {
        name: "Deleted Dollies",
        description: "API permettant de gérer les dollies supprimées",
      },
      {
        name: "Deleted Tasks",
        description: "API permettant de gérer les tâches",
      },
      {
        name: "Devices",
        description: "API permettant de gérer les appareils",
      },
      {
        name: "Incidents Robots",
        description: "API permettant de gérer les robots",
      },
      {
        name: "Incidents",
        description: "API permettant de gérer les incidents",
      },
      {
        name: "Mappings",
        description: "API permettant de gérer les emplacements",
      },
      {
        name: "Missions",
        description: "API permettant de gérer les missions",
      },
      {
        name: "Packaging location",
        description:
          "API permettant de gérer les emplacements selon emballages",
      },
      {
        name: "Robots",
        description: "API permettant de gérer les robots",
      },
      {
        name: "Scenario",
        description: "API permettant de gérer les scénarios",
      },
      {
        name: "Tasks",
        description: "API permettant de gérer les taches",
      },
      {
        name: "Users",
        description: "API permettant de gérer les utilisateurs",
      },
    ],
    components: {
      schemas: {},
      securitySchemes: {
        "Credentials for connection": {
          type: "http",
          description: "Credentials in order to connect to the API",
          scheme: "basic",
        },
        "Credential with token": {
          type: "http",
          description:
            "Credentials once connected with the token return by the connect",
          scheme: "basic",
        },
      },
    },
  },
  // Path to the API docs
  apis: [
    "./src/routes/actuatorRoutes.js",
    "./src/routes/adminRoutes.js",
    "./src/routes/alleeRoutes.js",
    "./src/routes/articlesRoutes.js",
    "./src/routes/boschConfigRoutes.js",
    "./src/routes/columnsRoutes.js",
    "./src/routes/dashboardRoutes.js",
    "./src/routes/deletedTasksRoutes.js",
    "./src/routes/deletedDolliesRoutes.js",
    "./src/routes/deviceRoutes.js",
    "./src/routes/incidentRobotRoutes.js",
    "./src/routes/incidentsRoutes.js",
    "./src/routes/mappingsRoutes.js",
    "./src/routes/missionsRoutes.js",
    "./src/routes/packagingLocationRoutes.js",
    "./src/routes/robotsRoutes.js",
    "./src/routes/scenarioRoutes.js",
    "./src/routes/tasksRoutes.js",
    "./src/routes/userRoutes.js",
  ],
};
