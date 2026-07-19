#!/bin/bash
set -Eeuo pipefail

release_commit="${1:-}"
image_tag="${2:-}"
environment_parameter_name="${3:-}"
aws_region="${4:-}"
aws_account_id="${5:-}"

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]] ||
  [[ ! "$image_tag" =~ ^[0-9a-f]{40}$ ]] ||
  [[ -z "$environment_parameter_name" ]] ||
  [[ ! "$aws_region" =~ ^[a-z]{2}-[a-z]+-[0-9]+$ ]] ||
  [[ ! "$aws_account_id" =~ ^[0-9]{12}$ ]]; then
  echo "The runtime refresh arguments are invalid." >&2
  exit 2
fi

runtime_dir="/opt/plandelta"
repository_raw_url="https://raw.githubusercontent.com/abdullahahsen05/plandelta-ai/${release_commit}/infrastructure/runtime"
cd "$runtime_dir"
umask 077

curl --fail --silent --show-error --location \
  "${repository_raw_url}/docker-compose.prod.yml" \
  --output docker-compose.prod.yml
curl --fail --silent --show-error --location \
  "${repository_raw_url}/Caddyfile" \
  --output Caddyfile

aws ssm get-parameter \
  --name "$environment_parameter_name" \
  --with-decryption \
  --region "$aws_region" \
  --query Parameter.Value \
  --output text | base64 --decode > .env.bundle.json
jq --raw-output .api .env.bundle.json | base64 --decode > .env.api
jq --raw-output .agent .env.bundle.json | base64 --decode > .env.agent
jq --raw-output .vision .env.bundle.json | base64 --decode > .env.vision
rm --force .env.bundle.json
chmod 0600 .env.agent .env.api .env.vision

metadata_token="$(curl --fail --silent --show-error --request PUT \
  --header "X-aws-ec2-metadata-token-ttl-seconds: 300" \
  http://169.254.169.254/latest/api/token)"
public_ip="$(curl --fail --silent --show-error \
  --header "X-aws-ec2-metadata-token: ${metadata_token}" \
  http://169.254.169.254/latest/meta-data/public-ipv4)"
previous_public_host="$(
  if [[ -f .env.runtime ]]; then
    sed --quiet 's/^PUBLIC_HOST=//p' .env.runtime
  fi
)"

cat > .env.runtime <<RUNTIME_ENV
AWS_ACCOUNT_ID=${aws_account_id}
AWS_REGION=${aws_region}
IMAGE_TAG=${image_tag}
PUBLIC_HOST=${public_ip}
RUNTIME_ENV
chmod 0644 .env.runtime

aws ecr get-login-password --region "$aws_region" |
  docker login \
    --username AWS \
    --password-stdin \
    "${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com"
docker compose --env-file .env.runtime -f docker-compose.prod.yml pull \
  agent api worker vision proxy

certificate_path="/opt/plandelta/certbot/live/${public_ip}/fullchain.pem"
if [[ "$previous_public_host" != "$public_ip" ]] || [[ ! -f "$certificate_path" ]]; then
  docker compose --env-file .env.runtime -f docker-compose.prod.yml stop proxy || true
  docker run --rm --network host \
    --volume /opt/plandelta/certbot:/etc/letsencrypt \
    certbot/certbot:v5.4.0 certonly \
    --standalone \
    --preferred-profile shortlived \
    --ip-address "$public_ip" \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email
fi

docker compose --env-file .env.runtime -f docker-compose.prod.yml \
  up --detach --remove-orphans --wait --wait-timeout 300
curl --fail --silent --show-error --retry 20 --retry-delay 5 --retry-all-errors \
  --resolve "${public_ip}:443:127.0.0.1" \
  "https://${public_ip}/health/ready" > /dev/null

echo "PlanDelta runtime refresh completed for ${release_commit}."
