// =============================================================================
// Pipeline CI de la Bijouterie
// -----------------------------------------------------------------------------
// Construit les 3 images Docker (frontend, backend, mysql), les tague avec le
// numéro de build Jenkins (+ latest), les pousse sur Docker Hub, puis
// (bonus GitOps) met à jour le tag des images dans k8s/*-deployment.yaml :
// Argo CD détecte ce commit et déploie la nouvelle version.
//
// Credentials Jenkins nécessaires (Manage Jenkins > Credentials) :
//   dockerhub-credentials : Username with password = compte Docker Hub + Access Token
//   github-credentials    : Username with password = compte GitHub + Personal Access Token
//                           (uniquement pour le stage « Update manifests »)
// =============================================================================
pipeline {
    // Exécution sur l'agent intégré (le conteneur Jenkins, qui a le client docker)
    agent any

    // Variables communes à tous les stages
    environment {
        DOCKERHUB_USER = 'bassirou2024'                    // compte Docker Hub
        IMAGE_PREFIX   = "${DOCKERHUB_USER}/bijouterie"    // -> bassirou2024/bijouterie-<service>
        IMAGE_TAG      = "${BUILD_NUMBER}"                 // tag unique = numéro du build
        GIT_REPO       = 'github.com/mbg1984/bijouterie-microservices.git'
    }

    // Paramètre pour activer / désactiver le stage bonus au lancement
    parameters {
        booleanParam(name: 'UPDATE_MANIFESTS', defaultValue: true,
                     description: 'Mettre à jour le tag des images dans k8s/ et pousser le commit (GitOps)')
    }

    // Déclencheur : Jenkins interroge GitHub toutes les 2 minutes environ
    // (un webhook GitHub ne peut pas joindre un Jenkins local sans tunnel)
    triggers {
        pollSCM('H/2 * * * *')
    }

    options {
        timestamps()                                    // horodatage dans la console
        disableConcurrentBuilds()                       // un seul build à la fois
        buildDiscarder(logRotator(numToKeepStr: '10'))  // garde les 10 derniers builds
    }

    stages {

        // ---------------------------------------------------------------------
        // 1. Checkout : récupération du code depuis le dépôt Git du job
        // ---------------------------------------------------------------------
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Le commit poussé par le stage « Update manifests » contient
                    // [skip ci] : on ne reconstruit pas les images pour ce commit,
                    // sinon chaque build déclencherait un nouveau build (boucle).
                    // Seuls les builds lancés par la scrutation Git (pollSCM) sont
                    // concernés : un build lancé à la main s'exécute toujours.
                    def message = sh(script: 'git log -1 --pretty=%s', returnStdout: true).trim()
                    def parScrutation = !currentBuild.getBuildCauses('hudson.triggers.SCMTrigger$SCMTriggerCause').isEmpty()
                    env.SKIP_CI = (parScrutation && message.contains('[skip ci]')) ? 'true' : 'false'
                    echo "Dernier commit : ${message} (déclenché par Git = ${parScrutation}, skip ci = ${env.SKIP_CI})"
                }
            }
        }

        // ---------------------------------------------------------------------
        // 2. Build : construction des 3 images à partir de leurs Dockerfiles
        // ---------------------------------------------------------------------
        stage('Build') {
            when { expression { env.SKIP_CI != 'true' } }
            steps {
                sh '''
                    docker build -t bijouterie-frontend:${IMAGE_TAG} frontend/
                    docker build -t bijouterie-backend:${IMAGE_TAG}  backend/
                    docker build -t bijouterie-mysql:${IMAGE_TAG}    database/
                '''
            }
        }

        // ---------------------------------------------------------------------
        // 3. Tag : chaque image reçoit 2 tags sur le dépôt Docker Hub
        //    - <numéro de build> : version immuable, utilisée dans les manifests
        //    - latest            : dernière version construite (jamais dans k8s/)
        // ---------------------------------------------------------------------
        stage('Tag') {
            when { expression { env.SKIP_CI != 'true' } }
            steps {
                sh '''
                    for service in frontend backend mysql; do
                        docker tag bijouterie-${service}:${IMAGE_TAG} ${IMAGE_PREFIX}-${service}:${IMAGE_TAG}
                        docker tag bijouterie-${service}:${IMAGE_TAG} ${IMAGE_PREFIX}-${service}:latest
                    done
                    docker images "${IMAGE_PREFIX}-*"
                '''
            }
        }

        // ---------------------------------------------------------------------
        // 4. Push : connexion à Docker Hub avec le credential Jenkins puis envoi
        //    Le token n'apparaît jamais en clair : withCredentials le place dans
        //    des variables masquées (****) dans la console.
        // ---------------------------------------------------------------------
        stage('Push') {
            when { expression { env.SKIP_CI != 'true' } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
                                                  usernameVariable: 'DOCKERHUB_LOGIN',
                                                  passwordVariable: 'DOCKERHUB_TOKEN')]) {
                    // Guillemets simples : c'est le shell (et non Groovy) qui lit
                    // le token -> il n'est pas interpolé dans le script Jenkins
                    sh '''
                        echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_LOGIN" --password-stdin
                        for service in frontend backend mysql; do
                            docker push ${IMAGE_PREFIX}-${service}:${IMAGE_TAG}
                            docker push ${IMAGE_PREFIX}-${service}:latest
                        done
                    '''
                }
            }
        }

        // ---------------------------------------------------------------------
        // 5. (Bonus) Update manifests : remplace le tag des images dans
        //    k8s/*-deployment.yaml par le nouveau numéro de build, committe et
        //    pousse. Argo CD voit le commit et déploie la nouvelle version.
        // ---------------------------------------------------------------------
        stage('Update manifests') {
            when {
                allOf {
                    expression { env.SKIP_CI != 'true' }
                    expression { params.UPDATE_MANIFESTS }
                }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'github-credentials',
                                                  usernameVariable: 'GIT_LOGIN',
                                                  passwordVariable: 'GIT_TOKEN')]) {
                    sh '''
                        # image: bassirou2024/bijouterie-<service>:<ancien tag> -> :<IMAGE_TAG>
                        sed -i -E "s#(image: ${IMAGE_PREFIX}-[a-z]+):[A-Za-z0-9._-]+#\\1:${IMAGE_TAG}#" k8s/*-deployment.yaml
                        grep -n "image:" k8s/*-deployment.yaml

                        git config user.name  "Jenkins CI"
                        git config user.email "jenkins@bijouterie.local"
                        git add k8s/*-deployment.yaml
                        # Rien à committer si le tag était déjà le bon
                        git diff --cached --quiet && { echo "Manifests déjà à jour"; exit 0; }
                        git commit -m "ci: images bijouterie build ${IMAGE_TAG} [skip ci]"
                        git push "https://${GIT_LOGIN}:${GIT_TOKEN}@${GIT_REPO}" HEAD:main
                    '''
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Actions exécutées après tous les stages, quel que soit le résultat
    // -------------------------------------------------------------------------
    post {
        always {
            sh 'docker logout || true'   // supprime la session Docker Hub de l'agent
        }
        success {
            echo "Images ${IMAGE_PREFIX}-{frontend,backend,mysql}:${IMAGE_TAG} publiées sur Docker Hub"
        }
    }
}
