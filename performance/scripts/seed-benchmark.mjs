import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const API_BASE_URL =
  process.env.BENCHMARK_API_URL ??
  'http://localhost:3001/api/v1';

const BENCHMARK_EMAIL =
  process.env.BENCHMARK_EMAIL ??
  'benchmark-owner@meridian.local';

const BENCHMARK_PASSWORD =
  process.env.BENCHMARK_PASSWORD ??
  'MeridianBenchmark123!';

const BENCHMARK_NAME =
  'Meridian Benchmark Owner';

const BENCHMARK_PREFIX = '[BENCH]';

const SECONDARY_TRIP_COUNT = 20;

const SEED_DELAY_MS = Number(
  process.env.BENCHMARK_SEED_DELAY_MS ?? '250',
);

const PRIMARY_TRIP = {
  name: '[BENCH] Primary Performance Journey',
  destination: 'Rome, Italy',
  startDate: '2026-10-10T00:00:00.000Z',
  endDate: '2026-10-19T00:00:00.000Z',
  timezone: 'Europe/Rome',
  currency: 'EUR',
};

const PLACE_CATEGORIES = [
  'LANDMARK',
  'FOOD',
  'LODGING',
  'SHOPPING',
  'TRANSPORT',
  'ENTERTAINMENT',
  'NATURE',
  'OTHER',
];

const ACTIVITY_CATEGORIES = [
  'SIGHTSEEING',
  'FOOD',
  'TRANSPORT',
  'LODGING',
  'SHOPPING',
  'ENTERTAINMENT',
  'OTHER',
];

const EXPENSE_CATEGORIES = [
  'ACCOMMODATION',
  'FOOD',
  'TRANSPORT',
  'ACTIVITIES',
  'SHOPPING',
  'HEALTH',
  'OTHER',
];

const ACTIVITY_TIMES = [
  ['09:00', '10:00'],
  ['11:00', '12:00'],
  ['13:30', '14:30'],
  ['16:00', '17:00'],
  ['19:00', '20:00'],
];

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function seedPause() {
  if (
    Number.isFinite(SEED_DELAY_MS) &&
    SEED_DELAY_MS > 0
  ) {
    await sleep(SEED_DELAY_MS);
  }
}

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

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rawRequest(
  path,
  {
    method = 'GET',
    token,
    body,
  } = {},
) {
  const headers = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] =
      'application/json';
  }

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    },
  );

  const payload =
    await parseResponse(response);

  return {
    response,
    payload,
  };
}

async function apiRequest(
  path,
  options = {},
) {
  const result = await rawRequest(
    path,
    options,
  );

  if (!result.response.ok) {
    throw new Error(
      [
        `${options.method ?? 'GET'} ${path}`,
        `failed with ${result.response.status}`,
        JSON.stringify(result.payload),
      ].join(' — '),
    );
  }

  return unwrap(result.payload);
}

async function healthCheck() {
  const health =
    await apiRequest('/health');

  if (
    !health ||
    health.status !== 'ok'
  ) {
    throw new Error(
      'Meridian health check failed.',
    );
  }

  console.log(
    '✓ Meridian API healthy',
  );
}

async function login() {
  return rawRequest(
    '/auth/login',
    {
      method: 'POST',
      body: {
        email: BENCHMARK_EMAIL,
        password:
          BENCHMARK_PASSWORD,
      },
    },
  );
}

async function ensureBenchmarkAccount() {
  let loginResult =
    await login();

  if (loginResult.response.ok) {
    console.log(
      '✓ Benchmark user already exists',
    );

    return unwrap(
      loginResult.payload,
    );
  }

  console.log(
    '• Benchmark user not available, registering...',
  );

  const registerResult =
    await rawRequest(
      '/auth/register',
      {
        method: 'POST',
        body: {
          name: BENCHMARK_NAME,
          email: BENCHMARK_EMAIL,
          password:
            BENCHMARK_PASSWORD,
        },
      },
    );

  if (
    !registerResult.response.ok &&
    registerResult.response.status !==
      409
  ) {
    throw new Error(
      `Registration failed with ${registerResult.response.status}: ${JSON.stringify(registerResult.payload)}`,
    );
  }

  loginResult =
    await login();

  if (!loginResult.response.ok) {
    throw new Error(
      `Benchmark login failed with ${loginResult.response.status}: ${JSON.stringify(loginResult.payload)}`,
    );
  }

  console.log(
    '✓ Benchmark user ready',
  );

  return unwrap(
    loginResult.payload,
  );
}

async function removePreviousDataset(
  token,
) {
  const trips =
    await apiRequest('/trips', {
      token,
    });

  if (!Array.isArray(trips)) {
    throw new Error(
      'GET /trips did not return an array.',
    );
  }

  const benchmarkTrips =
    trips.filter(
      (trip) =>
        typeof trip.name === 'string' &&
        trip.name.startsWith(
          BENCHMARK_PREFIX,
        ),
    );

  if (
    benchmarkTrips.length === 0
  ) {
    console.log(
      '✓ No previous benchmark trips',
    );

    return;
  }

  console.log(
    `• Removing ${benchmarkTrips.length} previous benchmark trips...`,
  );

  for (
    const trip of benchmarkTrips
  ) {
    await apiRequest(
      `/trips/${trip.id}`,
      {
        method: 'DELETE',
        token,
      },
    );

    await seedPause();
  }

  console.log(
    '✓ Previous benchmark dataset removed',
  );
}

async function createTrip(
  token,
  payload,
) {
  const trip =
    await apiRequest('/trips', {
      method: 'POST',
      token,
      body: payload,
    });

  await seedPause();

  return trip;
}

function addUtcDays(
  input,
  days,
) {
  const date = new Date(input);

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date;
}

async function createSecondaryTrips(
  token,
) {
  const trips = [];

  const baseDate =
    new Date(
      '2027-01-05T00:00:00.000Z',
    );

  for (
    let index = 0;
    index <
    SECONDARY_TRIP_COUNT;
    index += 1
  ) {
    const startDate =
      addUtcDays(
        baseDate,
        index * 3,
      );

    const endDate =
      addUtcDays(
        startDate,
        5,
      );

    const number =
      String(index + 1).padStart(
        2,
        '0',
      );

    const trip =
      await createTrip(
        token,
        {
          name:
            `[BENCH] Load Trip ${number}`,
          destination:
            `Benchmark Destination ${number}`,
          startDate:
            startDate.toISOString(),
          endDate:
            endDate.toISOString(),
          timezone: 'UTC',
          currency: 'USD',
        },
      );

    trips.push(trip);
  }

  console.log(
    `✓ ${trips.length} secondary trips created`,
  );

  return trips;
}

async function createPlaces(
  token,
  tripId,
) {
  const places = [];

  for (
    let index = 0;
    index < 30;
    index += 1
  ) {
    const number =
      String(index + 1).padStart(
        2,
        '0',
      );

    const place =
      await apiRequest(
        `/trips/${tripId}/places`,
        {
          method: 'POST',
          token,
          body: {
            name:
              `Benchmark Place ${number}`,
            category:
              PLACE_CATEGORIES[
                index %
                  PLACE_CATEGORIES.length
              ],
            address:
              `${100 + index} Via Benchmark, Rome, Italy`,
            latitude:
              Number(
                (
                  41.89 +
                  index * 0.001
                ).toFixed(6),
              ),
            longitude:
              Number(
                (
                  12.49 +
                  index * 0.001
                ).toFixed(6),
              ),
            notes:
              'Synthetic benchmark place for Meridian performance testing.',
            sourceProvider:
              'meridian-benchmark',
            sourcePlaceId:
              `bench-place-${number}`,
          },
        },
      );

    places.push(place);

    await seedPause();
  }

  console.log(
    `✓ ${places.length} places created`,
  );

  return places;
}

async function getTripDays(
  token,
  tripId,
) {
  const itinerary =
    await apiRequest(
      `/trips/${tripId}/itinerary`,
      {
        token,
      },
    );

  if (
    !itinerary ||
    !Array.isArray(
      itinerary.days,
    )
  ) {
    throw new Error(
      'Itinerary response did not contain days.',
    );
  }

  return [...itinerary.days].sort(
    (left, right) =>
      left.dayNumber -
      right.dayNumber,
  );
}

async function createActivities(
  token,
  tripId,
  days,
  places,
) {
  let created = 0;

  for (
    let dayIndex = 0;
    dayIndex < days.length;
    dayIndex += 1
  ) {
    const day =
      days[dayIndex];

    for (
      let position = 0;
      position < 5;
      position += 1
    ) {
      const globalIndex =
        dayIndex * 5 +
        position;

      const place =
        places[
          globalIndex %
            places.length
        ];

      const [
        startTime,
        endTime,
      ] =
        ACTIVITY_TIMES[position];

      await apiRequest(
        `/trips/${tripId}/itinerary/days/${day.id}/activities`,
        {
          method: 'POST',
          token,
          body: {
            title:
              `Benchmark Activity ${String(globalIndex + 1).padStart(2, '0')}`,
            description:
              'Synthetic itinerary activity used for repeatable Meridian performance measurements.',
            category:
              ACTIVITY_CATEGORIES[
                globalIndex %
                  ACTIVITY_CATEGORIES.length
              ],
            startTime,
            endTime,
            location:
              place.name,
            notes:
              `Benchmark day ${day.dayNumber}`,
            position,
            placeId:
              place.id,
          },
        },
      );

      created += 1;

      await seedPause();
    }
  }

  console.log(
    `✓ ${created} activities created`,
  );

  return created;
}

async function createBudget(
  token,
  tripId,
) {
  await apiRequest(
    `/trips/${tripId}/budget`,
    {
      method: 'PUT',
      token,
      body: {
        totalAmount:
          '25000.00',
      },
    },
  );

  await seedPause();

  const categoryLimits = {
    ACCOMMODATION: '5000.00',
    FOOD: '3000.00',
    TRANSPORT: '2500.00',
    ACTIVITIES: '3500.00',
    SHOPPING: '2500.00',
    HEALTH: '1500.00',
    OTHER: '1500.00',
  };

  for (
    const [
      category,
      amount,
    ] of Object.entries(
      categoryLimits,
    )
  ) {
    await apiRequest(
      `/trips/${tripId}/budget/categories/${category}`,
      {
        method: 'PUT',
        token,
        body: {
          amount,
        },
      },
    );

    await seedPause();
  }

  console.log(
    '✓ Budget + 7 category limits created',
  );
}

async function createExpenses(
  token,
  tripId,
) {
  const tripStart =
    new Date(
      PRIMARY_TRIP.startDate,
    );

  for (
    let index = 0;
    index < 150;
    index += 1
  ) {
    const category =
      EXPENSE_CATEGORIES[
        index %
          EXPENSE_CATEGORIES.length
      ];

    const dayOffset =
      index % 10;

    const spentAt =
      addUtcDays(
        tripStart,
        dayOffset,
      );

    spentAt.setUTCHours(
      8 + (index % 12),
      0,
      0,
      0,
    );

    const amount =
      (
        12 +
        ((index * 7) % 190) +
        (index % 4) * 0.25
      ).toFixed(2);

    await apiRequest(
      `/trips/${tripId}/expenses`,
      {
        method: 'POST',
        token,
        body: {
          title:
            `Benchmark Expense ${String(index + 1).padStart(3, '0')}`,
          category,
          amount,
          spentAt:
            spentAt.toISOString(),
          notes:
            'Synthetic expense generated for Meridian performance benchmarking.',
        },
      },
    );

    if (
      (index + 1) % 25 ===
      0
    ) {
      console.log(
        `  ${index + 1}/150 expenses`,
      );
    }

    await seedPause();
  }

  console.log(
    '✓ 150 expenses created',
  );
}

function getGitCommit() {
  try {
    return execFileSync(
      'git',
      [
        'rev-parse',
        'HEAD',
      ],
      {
        encoding: 'utf8',
      },
    ).trim();
  } catch {
    return null;
  }
}

async function writeManifest({
  owner,
  primaryTrip,
  secondaryTrips,
  days,
  places,
  activityCount,
}) {
  const outputDirectory =
    resolve(
      process.cwd(),
      'performance',
      'data',
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const manifest = {
    datasetVersion: 1,
    profile:
      'meridian-v1-api-baseline',
    generatedAt:
      new Date().toISOString(),
    gitCommit:
      getGitCommit(),
    apiBaseUrl:
      API_BASE_URL,
    owner: {
      id:
        owner?.id ?? null,
      email:
        BENCHMARK_EMAIL,
    },
    primaryTrip: {
      id:
        primaryTrip.id,
      name:
        primaryTrip.name,
      tripDays:
        days.length,
      places:
        places.length,
      activities:
        activityCount,
      expenses: 150,
      budgetCategoryLimits: 7,
    },
    secondaryTrips: {
      count:
        secondaryTrips.length,
      ids:
        secondaryTrips.map(
          (trip) => trip.id,
        ),
    },
    totalTrips:
      secondaryTrips.length +
      1,
    expectedCounts: {
      trips: 21,
      tripDays: 10,
      places: 30,
      activities: 50,
      budgets: 1,
      budgetCategoryLimits: 7,
      expenses: 150,
    },
    notes: [
      'No access tokens are persisted.',
      'No benchmark password is persisted.',
      'The dataset is synthetic and intended only for local performance testing.',
      'External-provider load testing is handled separately.',
    ],
  };

  const outputFile =
    resolve(
      outputDirectory,
      'benchmark-manifest.json',
    );

  await writeFile(
    outputFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `✓ Manifest written to ${outputFile}`,
  );
}

async function main() {
  console.log('');
  console.log(
    '======================================',
  );
  console.log(
    ' Meridian V2 — V1 Benchmark Seed',
  );
  console.log(
    '======================================',
  );
  console.log(
    `API: ${API_BASE_URL}`,
  );
  console.log(
    `Seed delay: ${SEED_DELAY_MS} ms`,
  );
  console.log('');

  await healthCheck();

  const loginData =
    await ensureBenchmarkAccount();

  const accessToken =
    loginData?.accessToken;

  const owner =
    loginData?.user;

  if (!accessToken) {
    throw new Error(
      'Login response did not contain an access token.',
    );
  }

  await removePreviousDataset(
    accessToken,
  );

  console.log(
    '• Creating primary benchmark journey...',
  );

  const primaryTrip =
    await createTrip(
      accessToken,
      PRIMARY_TRIP,
    );

  console.log(
    `✓ Primary trip: ${primaryTrip.id}`,
  );

  const secondaryTrips =
    await createSecondaryTrips(
      accessToken,
    );

  const days =
    await getTripDays(
      accessToken,
      primaryTrip.id,
    );

  if (days.length !== 10) {
    throw new Error(
      `Expected 10 trip days, received ${days.length}.`,
    );
  }

  console.log(
    `✓ ${days.length} trip days created`,
  );

  const places =
    await createPlaces(
      accessToken,
      primaryTrip.id,
    );

  const activityCount =
    await createActivities(
      accessToken,
      primaryTrip.id,
      days,
      places,
    );

  await createBudget(
    accessToken,
    primaryTrip.id,
  );

  await createExpenses(
    accessToken,
    primaryTrip.id,
  );

  await writeManifest({
    owner,
    primaryTrip,
    secondaryTrips,
    days,
    places,
    activityCount,
  });

  console.log('');
  console.log(
    '======================================',
  );
  console.log(
    ' Benchmark dataset READY',
  );
  console.log(
    '======================================',
  );
  console.log(
    `Trips:       ${secondaryTrips.length + 1}`,
  );
  console.log(
    `Days:        ${days.length}`,
  );
  console.log(
    `Places:      ${places.length}`,
  );
  console.log(
    `Activities:  ${activityCount}`,
  );
  console.log(
    'Expenses:    150',
  );
  console.log(
    'Budget:      1',
  );
  console.log(
    'Limits:      7',
  );
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error(
    'Benchmark seed FAILED',
  );
  console.error(error);
  process.exitCode = 1;
});