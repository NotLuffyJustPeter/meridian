import http from 'k6/http';
import { check } from 'k6';
import {
  Counter,
  Rate,
  Trend,
} from 'k6/metrics';
import exec from 'k6/execution';

const MANIFEST_PATH =
  __ENV.MANIFEST_PATH ??
  '../data/benchmark-manifest.json';

const manifest =
  JSON.parse(
    open(MANIFEST_PATH),
  );

const BASE_URL =
  __ENV.BASE_URL ??
  'http://localhost:3001/api/v1';

const BENCHMARK_EMAIL =
  __ENV.BENCHMARK_EMAIL ??
  'benchmark-owner@meridian.local';

const BENCHMARK_PASSWORD =
  __ENV.BENCHMARK_PASSWORD;

const RUN_ID =
  __ENV.RUN_ID ??
  'v1-baseline-manual';

const RATE =
  Number(
    __ENV.RATE ?? '4',
  );

const DURATION =
  __ENV.DURATION ??
  '5m';

if (!BENCHMARK_PASSWORD) {
  throw new Error(
    'BENCHMARK_PASSWORD is required.',
  );
}

const primaryTripId =
  manifest.primaryTrip?.id;

if (!primaryTripId) {
  throw new Error(
    'primaryTrip.id is missing from benchmark-manifest.json',
  );
}

const ENDPOINTS = [
  {
    key: 'health',
    label: 'GET /health',
    path: '/health',
    auth: false,
  },
  {
    key: 'trips_list',
    label: 'GET /trips',
    path: '/trips',
    auth: true,
  },
  {
    key: 'trip_detail',
    label: 'GET /trips/:id',
    path: `/trips/${primaryTripId}`,
    auth: true,
  },
  {
    key: 'itinerary',
    label: 'GET itinerary',
    path:
      `/trips/${primaryTripId}/itinerary`,
    auth: true,
  },
  {
    key: 'places',
    label: 'GET places',
    path:
      `/trips/${primaryTripId}/places`,
    auth: true,
  },
  {
    key: 'budget_overview',
    label: 'GET budget overview',
    path:
      `/trips/${primaryTripId}/budget/overview`,
    auth: true,
  },
  {
    key: 'expenses',
    label: 'GET expenses',
    path:
      `/trips/${primaryTripId}/expenses`,
    auth: true,
  },
];

const endpointRequests =
  new Counter(
    'baseline_endpoint_requests',
  );

const endpointErrors =
  new Rate(
    'baseline_endpoint_errors',
  );

const baselineDuration =
  new Trend(
    'baseline_request_duration',
    true,
  );

const endpointDuration = {
  health:
    new Trend(
      'endpoint_health_duration',
      true,
    ),

  trips_list:
    new Trend(
      'endpoint_trips_list_duration',
      true,
    ),

  trip_detail:
    new Trend(
      'endpoint_trip_detail_duration',
      true,
    ),

  itinerary:
    new Trend(
      'endpoint_itinerary_duration',
      true,
    ),

  places:
    new Trend(
      'endpoint_places_duration',
      true,
    ),

  budget_overview:
    new Trend(
      'endpoint_budget_overview_duration',
      true,
    ),

  expenses:
    new Trend(
      'endpoint_expenses_duration',
      true,
    ),
};

export const options = {
  scenarios: {
    api_baseline: {
      executor:
        'constant-arrival-rate',

      rate: RATE,

      timeUnit: '1s',

      duration:
        DURATION,

      preAllocatedVUs: 4,

      maxVUs: 20,
    },
  },

  thresholds: {
    http_req_failed: [
      'rate<0.01',
    ],

    baseline_endpoint_errors: [
      'rate<0.01',
    ],

    checks: [
      'rate>0.99',
    ],
  },

  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(50)',
    'p(90)',
    'p(95)',
    'p(99)',
  ],
};

function unwrap(payload) {
  if (
    payload &&
    typeof payload === 'object' &&
    Object.prototype.hasOwnProperty.call(
      payload,
      'data',
    )
  ) {
    return payload.data;
  }

  return payload;
}

export function setup() {
  const response =
    http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        email:
          BENCHMARK_EMAIL,

        password:
          BENCHMARK_PASSWORD,
      }),
      {
        headers: {
          'Content-Type':
            'application/json',

          Accept:
            'application/json',
        },

        tags: {
          name:
            'benchmark_login_setup',
        },
      },
    );

  if (
    response.status !== 200
  ) {
    throw new Error(
      `Benchmark login failed: ${response.status} ${response.body}`,
    );
  }

  const payload =
    unwrap(
      response.json(),
    );

  const accessToken =
    payload?.accessToken;

  if (!accessToken) {
    throw new Error(
      'Login response did not contain accessToken.',
    );
  }

  return {
    accessToken,
  };
}

export default function (
  data,
) {
  const iteration =
    exec.scenario
      .iterationInTest;

  const endpoint =
    ENDPOINTS[
      iteration %
        ENDPOINTS.length
    ];

  const headers = {
    Accept:
      'application/json',
  };

  if (endpoint.auth) {
    headers.Authorization =
      `Bearer ${data.accessToken}`;
  }

  const response =
    http.get(
      `${BASE_URL}${endpoint.path}`,
      {
        headers,

        tags: {
          name:
            endpoint.key,

          endpoint:
            endpoint.key,
        },
      },
    );

  baselineDuration.add(
    response.timings.duration,
  );

  endpointDuration[
    endpoint.key
  ].add(
    response.timings.duration,
  );

  endpointRequests.add(
    1,
    {
      endpoint:
        endpoint.key,
    },
  );

  const successful =
    check(
      response,
      {
        [`${endpoint.key} returned 2xx`]:
          (result) =>
            result.status >= 200 &&
            result.status < 300,
      },
    );

  endpointErrors.add(
    !successful,
    {
      endpoint:
        endpoint.key,
    },
  );
}

function metricValues(
  data,
  name,
) {
  return (
    data.metrics?.[name]
      ?.values ?? {}
  );
}

function numberOrNull(
  value,
) {
  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

function formatNumber(
  value,
  digits = 2,
) {
  if (
    !Number.isFinite(value)
  ) {
    return 'n/a';
  }

  return value.toFixed(
    digits,
  );
}

function latencySummary(
  values,
) {
  return {
    avgMs:
      numberOrNull(
        values.avg,
      ),

    p50Ms:
      numberOrNull(
        values['p(50)'],
      ),

    p90Ms:
      numberOrNull(
        values['p(90)'],
      ),

    p95Ms:
      numberOrNull(
        values['p(95)'],
      ),

    p99Ms:
      numberOrNull(
        values['p(99)'],
      ),

    minMs:
      numberOrNull(
        values.min,
      ),

    maxMs:
      numberOrNull(
        values.max,
      ),
  };
}

export function handleSummary(
  data,
) {
  const durationValues =
    metricValues(
      data,
      'baseline_request_duration',
    );

  const requestValues =
    metricValues(
      data,
      'baseline_endpoint_requests',
    );

  const failureValues =
    metricValues(
      data,
      'baseline_endpoint_errors',
    );

  const droppedValues =
    metricValues(
      data,
      'dropped_iterations',
    );

  const checkValues =
    metricValues(
      data,
      'checks',
    );

  const endpointMetrics =
    {};

  const outputLines = [
    '',
    '=============================================',
    ` Meridian V1 Baseline - ${RUN_ID}`,
    '=============================================',
    '',
    `Dataset commit: ${manifest.gitCommit}`,
    `Dataset version: ${manifest.datasetVersion}`,
    `Rate: ${RATE} req/s`,
    `Duration: ${DURATION}`,
    '',
    'AGGREGATE',
    `Requests: ${requestValues.count ?? 'n/a'}`,
    `Throughput: ${formatNumber(requestValues.rate)} req/s`,
    `Error rate: ${formatNumber((failureValues.rate ?? 0) * 100, 4)}%`,
    `Checks: ${formatNumber((checkValues.rate ?? 0) * 100, 4)}%`,
    `Dropped iterations: ${droppedValues.count ?? 0}`,
    '',
    `p50: ${formatNumber(durationValues['p(50)'])} ms`,
    `p90: ${formatNumber(durationValues['p(90)'])} ms`,
    `p95: ${formatNumber(durationValues['p(95)'])} ms`,
    `p99: ${formatNumber(durationValues['p(99)'])} ms`,
    '',
    'ENDPOINT LATENCIES',
  ];

  for (
    const endpoint of
    ENDPOINTS
  ) {
    const metricName =
      `endpoint_${endpoint.key}_duration`;

    const values =
      metricValues(
        data,
        metricName,
      );

    endpointMetrics[
      endpoint.key
    ] = {
      label:
        endpoint.label,

      latency:
        latencySummary(
          values,
        ),
    };

    outputLines.push(
      '',
      endpoint.label,
      `  p50: ${formatNumber(values['p(50)'])} ms`,
      `  p95: ${formatNumber(values['p(95)'])} ms`,
      `  p99: ${formatNumber(values['p(99)'])} ms`,
    );
  }

  const artifact = {
    benchmarkVersion:
      1,

    profile:
      'meridian-v1-api-baseline',

    runId:
      RUN_ID,

    dataset: {
      version:
        manifest.datasetVersion,

      gitCommit:
        manifest.gitCommit,

      generatedAt:
        manifest.generatedAt,

      primaryTripId:
        primaryTripId,

      totalTrips:
        manifest.totalTrips,
    },

    configuration: {
      baseUrl:
        BASE_URL,

      ratePerSecond:
        RATE,

      duration:
        DURATION,

      endpointCount:
        ENDPOINTS.length,
    },

    aggregate: {
      totalRequests:
        numberOrNull(
          requestValues.count,
        ),

      throughputRps:
        numberOrNull(
          requestValues.rate,
        ),

      errorRate:
        numberOrNull(
          failureValues.rate,
        ),

      checkRate:
        numberOrNull(
          checkValues.rate,
        ),

      droppedIterations:
        numberOrNull(
          droppedValues.count ?? 0,
        ),

      latency:
        latencySummary(
          durationValues,
        ),
    },

    endpoints:
      endpointMetrics,
  };

  return {
    stdout:
      `${outputLines.join('\n')}\n`,

    [`performance/results/${RUN_ID}.json`]:
      `${JSON.stringify(artifact, null, 2)}\n`,
  };
}