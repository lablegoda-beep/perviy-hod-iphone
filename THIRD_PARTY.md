# Third-party components — Первый ход 1.3

## Stockfish.js 19.0.1 Lite Single

Unmodified upstream JavaScript glue and WebAssembly engine:
- `vendor/stockfish/stockfish-19-lite-single.js`
- `vendor/stockfish/stockfish-19-lite-single.wasm`

Origin: https://unpkg.com/stockfish@19.0.1/bin/ . The npm version is pinned to 19.0.1. The compiled header identifies Stockfish.js 19, Chess.com, LLC, and the original Stockfish contributors.

License: GNU General Public License, version 3. The complete license is included in `vendor/stockfish/COPYING` and can also be viewed from the application's help dialog. Upstream authorship and license notices remain intact in the embedded worker script.

Corresponding source and build scripts are included in `vendor/stockfish/source-v19.0.1.tar.gz` from the upstream `v19.0.1` tag, commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`:
https://github.com/nmrugg/stockfish.js/tree/v19.0.1 . Consult the included upstream README and `build.js --help` for compiler requirements and the Lite Single build options.

The original Lite neural-network file is also included:
`vendor/stockfish/nn-61e7af4bb97d.nnue`.
Origin: https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue .
SHA-256: `61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b`.
This matches `EvalFileLiteName` in the bundled upstream source and the notice in the downloaded engine script. The network is already embedded inside the supplied WASM engine at runtime.

`vendor/stockfish/provenance.json` records versions, origins, sizes and SHA-256 hashes of the vendored files. No Stockfish source or binary modifications were made. `src/engine.js` is the application-side UCI bridge: it starts the separate Web Worker and supplies the embedded WASM through a local, in-memory Response. It contains cancellation, time limits and legal-move validation. No remote engine service is used.

The source and portable archives include the vendored engine source, network, license and application build sources. The engine is provided without warranty; see the full GPL text.

## chess.js 1.4.0

Rules, legal move generation and PGN parsing. License: BSD-2-Clause.
Upstream: https://jhlywa.github.io/chess.js/ .
Bundled file: `vendor/chess.cjs`; complete notice: `vendor/chess.LICENSE`. The license is also included in the HTML and help dialog.

## Lichess chess-openings

Opening-name reference data. Upstream: https://github.com/lichess-org/chess-openings . License: CC0.
The downloaded TSV files are in `data/`. The teaching repertoire is defined separately in `src/openings.cjs`.

## Development dependency

Playwright is used only by the local verification scripts. It is not loaded by the shipped HTML application. Its own package includes its license. Production use of the trainer needs neither Playwright nor Node.js.

## Teaching curriculum

The 28 lessons in `src/lessons.cjs`, their Russian explanations and constructed exercise positions were created for this application. No external course diagrams or exercise collections are reproduced. Each lesson includes supplementary primary-platform links to the relevant Chess.com educational glossary/articles or Lichess learning and practice pages; the complete URL map is in `sources` within `src/lessons.cjs`.

During development, 13 sparse-position outcome checks were queried against the Lichess tablebase service at `https://tablebase.lichess.ovh/standard`; the queried FENs and returned outcomes are recorded in `tests/academy-tablebase-report.json`. These were generated teaching positions, not private user games. The app never calls the service while a user studies.

## Repertoire expansion 1.4

The 61 historical teaching lines are unchanged. New course branches combine editorial seed positions with limited local Stockfish principal variations; the UI labels the engine-derived continuation and does not claim unique optimality. All paths are validated with chess.js.

Opening name reference: lichess-org/chess-openings, CC0, commit a6189a30dc273ccb21fc2536a9a2fefd5592a67a. Snapshot and generation metadata are retained in data/expanded. This reference contains names and move sequences, not game-frequency statistics.
