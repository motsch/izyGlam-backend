FROM rabbitmq:3-management

# Active les plugins nécessaires
RUN rabbitmq-plugins enable --offline rabbitmq_mqtt rabbitmq_web_mqtt

EXPOSE 5672 1883 15672
