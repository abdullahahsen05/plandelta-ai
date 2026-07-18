# AWS cost and credit record

Verified 2026-07-18 for account `472888337670` in `us-east-1`. Prices were read from the AWS Price
List API through the authenticated non-root `plandelta` profile. They are estimates, not a promise
of the final bill; AWS pricing and free-tier treatment can change.

## Credit eligibility

The AWS Billing credit detail showed one active `AWS Free Tier` credit:

- issued amount: USD 100.00
- current amount remaining: USD 100.00
- estimated amount used: USD 0.01
- estimated amount remaining: USD 99.99
- status: Active

The credit's complete applicable-product list explicitly included the services PlanDelta uses:
Amazon Elastic Compute Cloud, Amazon Simple Storage Service, Amazon EC2 Container Registry,
Amazon Bedrock and Amazon Bedrock Foundation Models, AmazonCloudWatch, AWS Data Transfer, AWS
Budgets, AWS CloudFormation, and AWS Systems Manager.

This confirms product eligibility, not that every line item or future price is guaranteed to be
credited. Gross-cost budget alerts remain mandatory. The credit table rendered `07/04/2026` and
`07/04/2027`, while the separate Free plan status displayed an access end date of January 4, 2027.
Because the numeric date locale is ambiguous and the gates differ, PlanDelta does not depend on
remaining active for either full period.

## Unit prices observed

| Component | Verified unit price |
| --- | ---: |
| Linux `t3.small` on demand | USD 0.0208 / instance-hour |
| General Purpose SSD `gp3` | USD 0.08 / GB-month |
| In-use public IPv4 | USD 0.005 / hour |
| S3 Standard, first 50 TB | USD 0.023 / GB-month |
| S3 PUT/COPY/POST/LIST | USD 0.005 / 1,000 requests |
| S3 GET and other | USD 0.004 / 10,000 requests |
| ECR private image storage | USD 0.10 / GB-month |
| CloudWatch standard custom-log ingestion | USD 0.50 / GB |
| CloudWatch standard alarm metric | USD 0.10 / alarm-month |
| CloudWatch custom metric, first tier | USD 0.30 / metric-month |
| Nova Micro on-demand input | USD 0.000035 / 1,000 tokens |
| Nova Micro on-demand output | USD 0.00014 / 1,000 tokens |

No provisioned Bedrock throughput is used.

## Conservative monthly projection

The following is a ceiling-oriented estimate for a continuously running portfolio environment,
before credits or free allowances:

| Component assumption | Monthly estimate |
| --- | ---: |
| One `t3.small`, 730 hours | USD 15.18 |
| One 20 GB `gp3` volume | USD 1.60 |
| One public IPv4, 730 hours | USD 3.65 |
| 5 GB S3 plus 10k writes and 50k reads | USD 0.19 |
| 4 GB private ECR images | USD 0.40 |
| 0.5 GB logs, three metrics, three alarms | USD 1.45 |
| 100 Nova Micro summaries at 3k input / 600 output tokens | USD 0.02 |
| Conservative 5 GB internet transfer allowance | USD 0.45 |
| **Projected 30-day ceiling** | **USD 22.94** |

This is below the USD 25 target but leaves too little room for an unattended full month. PlanDelta
therefore treats live compute as a temporary portfolio environment:

- 72-hour verification target: approximately USD 3 before incidental usage.
- Seven-day demonstration target: approximately USD 7 before incidental usage.
- Stop or terminate EC2 after evidence capture; check EBS, public IPv4, ECR, S3, and CloudWatch
  separately because stopping an instance is not a complete teardown.
- Inspect actual and forecast cost at USD 15. Tear down nonessential resources at USD 25 unless the
  user explicitly authorizes more.

Budget notifications at USD 10, 15, 20, and 25 are deployed before the first persistent project
resource.

## Phase 9 deployment evidence

Verified on 2026-07-18:

- CloudFormation stacks `plandelta-cost-guard` and `plandelta-storage` reached
  `CREATE_COMPLETE`.
- The monthly gross-cost budget is USD 25 with actual-spend notifications at USD 10, 15, 20,
  and 25.
- The S3 bucket uses SSE-S3, bucket-owner-enforced ownership, all four public-access blocks, a
  non-public TLS-only policy, exact production-origin read-only CORS, and bounded lifecycle rules.
- The EC2 runtime role has the required `plandelta-runtime-boundary` permissions boundary and is
  limited to the PlanDelta S3 prefix, the configured on-demand model, PlanDelta logs, and PlanDelta
  metrics.
- A real provider check passed encrypted write/read, a signed read, an unsigned public `403`, a
  Nova Micro summary, and cleanup.
- The complete application journey passed upload, deterministic CV/OCR, seven private artifacts,
  a Bedrock report, protected reads, and API-driven deletion. The bucket was empty afterward.

Nova Micro does not support Bedrock's native `outputConfig` structured-output field. PlanDelta
therefore supplies the exact JSON schema in its evidence-only Micro prompt, parses the response with
a strict local schema and evidence-sequence allowlist, and falls back to the deterministic report
on any invalid response. Compatible future models retain native Bedrock structured output.

## Phase 10 live evidence

Verified on 2026-07-18:

- One `t3.small`, one encrypted 20 GB `gp3` root volume, one automatically assigned public IPv4,
  and one worker are live; no size increase was required.
- Public HTTPS readiness, all four long-running containers, SSM-only administration, standard T3
  credits, ports 80/443 only, seven-day CloudWatch retention, and immutable ECR repositories passed
  the automated Phase 10 verifier.
- The deployed authenticated journey completed with real CV/OCR, seven private artifacts, a Bedrock
  report, protected download, and cleanup. A deliberate 3/3-attempt failure then completed through
  the real retry endpoint after vision recovery.
- S3 contained zero project objects and zero incomplete multipart uploads after cleanup.
- AWS Budgets reported USD 0.00 actual spend and Cost Explorer reported an estimated USD 0.00
  unblended July total at the verification time. Billing data can lag usage, so the gross-cost
  alerts and USD 25 teardown gate remain authoritative.
