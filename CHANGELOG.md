# Changelog

## [5.1.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v5.0.1...aha-mcp-v5.1.0) (2026-08-12)


### Features

* enumerate a release's epics as a tool ([#331](https://github.com/cedricziel/aha-mcp/issues/331)) ([13e23b3](https://github.com/cedricziel/aha-mcp/commit/13e23b30e57db6cec0c6a41f9f81b444ae4dfb51))
* enumerate a release's features as a tool ([#329](https://github.com/cedricziel/aha-mcp/issues/329)) ([e778592](https://github.com/cedricziel/aha-mcp/commit/e778592bd9774fc2c70cf0230642ac8f30544d68))
* publish to the official MCP Registry ([#332](https://github.com/cedricziel/aha-mcp/issues/332)) ([12751e8](https://github.com/cedricziel/aha-mcp/commit/12751e835e1e9722dc09e71433fdaf98bbe7e9e3))

## [5.0.1](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v5.0.0...aha-mcp-v5.0.1) (2026-08-12)


### Bug Fixes

* advertise tool output schemas in JSON Schema 2020-12 ([#327](https://github.com/cedricziel/aha-mcp/issues/327)) ([e8a915a](https://github.com/cedricziel/aha-mcp/commit/e8a915a2ede2e39388e71474da2b563ae624d5a4))

## [5.0.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v4.0.0...aha-mcp-v5.0.0) (2026-08-12)


### ⚠ BREAKING CHANGES

* 17 collection resources now return text/markdown instead of application/json. Anything parsing their contents as JSON must change. Tier 3 collections and all single-record resources are unaffected.
* aha_search rejects a wildcard-only query. A call passing query "*" previously returned an arbitrary subset of records, or nothing at all when workspaceId was set; it now comes back as an isError result naming the query forms that work. Callers relying on "*" must pass a real term, or enumerate a workspace through the list resources instead.

### Features

* add goal and key result tools for Aha OKRs ([#325](https://github.com/cedricziel/aha-mcp/issues/325)) ([284e48d](https://github.com/cedricziel/aha-mcp/commit/284e48df5ed66f581a01392593e7f81c8d13ceb0))
* add single-record read tools and stop advertising "*" as a match-all ([#321](https://github.com/cedricziel/aha-mcp/issues/321)) ([e6f6208](https://github.com/cedricziel/aha-mcp/commit/e6f62086b0fe23bc59fdb392389e925e450c2dc0))
* read and write comments on every record type, including the ideas portal ([#323](https://github.com/cedricziel/aha-mcp/issues/323)) ([de70727](https://github.com/cedricziel/aha-mcp/commit/de70727b880311731562a1729c6945b2966e5698))
* render collection resource reads by measured payload tier ([#326](https://github.com/cedricziel/aha-mcp/issues/326)) ([ad47583](https://github.com/cedricziel/aha-mcp/commit/ad475839e64b5634b035b0baeddef75d9f66acdc))

## [4.0.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v3.0.0...aha-mcp-v4.0.0) (2026-08-12)


### ⚠ BREAKING CHANGES

* the aha_idea_watchers, aha_releases and aha_releases_filtered resources are removed, as no Aha endpoint backs them.

### Features

* render tool results as summaries and links instead of duplicated JSON ([#318](https://github.com/cedricziel/aha-mcp/issues/318)) ([46bac11](https://github.com/cedricziel/aha-mcp/commit/46bac111d89b226135708163c91a2a86f2c01f01))

## [3.0.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v2.0.0...aha-mcp-v3.0.0) (2026-08-12)


### ⚠ BREAKING CHANGES

* the aha_idea_watchers, aha_releases and aha_releases_filtered resources are removed, as no Aha endpoint backs them.
* bring the tool surface up to the 2026-07-28 tools spec ([#313](https://github.com/cedricziel/aha-mcp/issues/313))

### Features

* bring the tool surface up to the 2026-07-28 tools spec ([#313](https://github.com/cedricziel/aha-mcp/issues/313)) ([7117f17](https://github.com/cedricziel/aha-mcp/commit/7117f178dc9258db0e560aa8b0ab75854260dec3))
* migrate to aha-js 2.0.0 and drop endpoints Aha never had ([#316](https://github.com/cedricziel/aha-mcp/issues/316)) ([a076e74](https://github.com/cedricziel/aha-mcp/commit/a076e743bac80fec94f00f833bbb66f116f12c9f))


### Bug Fixes

* explain Aha's REST failures instead of leaking the axios message ([#312](https://github.com/cedricziel/aha-mcp/issues/312)) ([8e12c38](https://github.com/cedricziel/aha-mcp/commit/8e12c38c0c6a282fb743d161d74a654c095b95df))

## [2.0.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v1.0.0...aha-mcp-v2.0.0) (2026-08-12)


### ⚠ BREAKING CHANGES

* the `risk_assessment` and `success_metrics` prompts are removed. Their substance now lives in `feature_analysis`, which gained `known_risks` and `current_baseline` arguments and deeper risk and metrics sections. Anyone invoking either by name must switch to `feature_analysis`.

### Features

* add five account-workflow prompts, fold two redundant ones in ([#310](https://github.com/cedricziel/aha-mcp/issues/310)) ([68d4877](https://github.com/cedricziel/aha-mcp/commit/68d4877b603a56ed44eb0322ea2036e01ca66d73))
* annotate every MCP tool with behaviour hints ([#302](https://github.com/cedricziel/aha-mcp/issues/302)) ([b2ee3b5](https://github.com/cedricziel/aha-mcp/commit/b2ee3b57230921507b34d507622e233efa9e4c82))
* autocomplete prompt arguments that name an Aha record ([#309](https://github.com/cedricziel/aha-mcp/issues/309)) ([77bce16](https://github.com/cedricziel/aha-mcp/commit/77bce166bb27169634940c04c20a74bf38202a8b))
* give every prompt a display title ([#308](https://github.com/cedricziel/aha-mcp/issues/308)) ([46cd11b](https://github.com/cedricziel/aha-mcp/commit/46cd11be83f7f287b70fc77303d91de7dcaa2931))
* tell clients what this server is and to link the records it returns ([#307](https://github.com/cedricziel/aha-mcp/issues/307)) ([1bf07cc](https://github.com/cedricziel/aha-mcp/commit/1bf07cc8636379f6c97ba66ba32041f93e07c98d))


### Bug Fixes

* actually send custom field values when updating a feature ([#304](https://github.com/cedricziel/aha-mcp/issues/304)) ([0652cc2](https://github.com/cedricziel/aha-mcp/commit/0652cc2932ce3e2f2c9779a52965d3c80fc2e290))
* return absolute record links from aha_search ([#306](https://github.com/cedricziel/aha-mcp/issues/306)) ([013d4d6](https://github.com/cedricziel/aha-mcp/commit/013d4d6394ab999a89f7cf88db923a7522ef0f3d))

## [1.0.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.9.0...aha-mcp-v1.0.0) (2026-08-12)


### ⚠ BREAKING CHANGES

* the `sse` transport is removed. `--mode sse` and MCP_TRANSPORT_MODE=sse now fall back to `streamable-http` with a warning. If you talk HTTP directly, replace the `/sse` and `/messages` endpoints with the single `/mcp` endpoint. The `build:http` and
* the aha_sync_* and embedding/semantic-search tools are removed, along with the AHA_ENABLE_LOCAL_CACHE flag. Use aha_search instead, which needs no sync. The tool count goes from 49 (30 default) to 31.

### Features

* replace local semantic search with Aha's searchDocuments API ([#300](https://github.com/cedricziel/aha-mcp/issues/300)) ([67a7c7e](https://github.com/cedricziel/aha-mcp/commit/67a7c7e42aef7530b984e3643e9b370dfad3bb86))


### Bug Fixes

* resolve the cache path independently of cwd and make it opt-in ([#297](https://github.com/cedricziel/aha-mcp/issues/297)) ([7c6cce5](https://github.com/cedricziel/aha-mcp/commit/7c6cce5c4a7dcd21f1e25577ac8f9be0b05640e5))
* stop the e2e flake at its source, and remove the deprecated SSE transport ([#301](https://github.com/cedricziel/aha-mcp/issues/301)) ([27c6bac](https://github.com/cedricziel/aha-mcp/commit/27c6bac11fdbb48d8d43ab5c45745d17bc69b150))

## [0.9.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.8.0...aha-mcp-v0.9.0) (2026-08-12)


### Features

* ship a working .mcpb desktop extension and repair the release pipeline ([#294](https://github.com/cedricziel/aha-mcp/issues/294)) ([1c12f85](https://github.com/cedricziel/aha-mcp/commit/1c12f85d97d0f7a71298553fc793b083ae225396))

## [0.8.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.7.0...aha-mcp-v0.8.0) (2026-01-13)


### Features

* add Streamable HTTP transport with comprehensive e2e tests ([#203](https://github.com/cedricziel/aha-mcp/issues/203)) ([a179bd5](https://github.com/cedricziel/aha-mcp/commit/a179bd5518dc7efb3cc724ab7762a31aef0edfa6))


### Bug Fixes

* add test-level timeouts to Streamable HTTP e2e tests ([#207](https://github.com/cedricziel/aha-mcp/issues/207)) ([1d84a7a](https://github.com/cedricziel/aha-mcp/commit/1d84a7ab79db3a1a417cb0c30034879e93cc65ed))
* increase default test client connection timeout for CI ([#206](https://github.com/cedricziel/aha-mcp/issues/206)) ([5f4eafd](https://github.com/cedricziel/aha-mcp/commit/5f4eafdb66f93251666f7193a2960d8a90f6bfb3))

## [0.7.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.6.2...aha-mcp-v0.7.0) (2026-01-12)


### Features

* add comprehensive filtering and pagination parameters to ideas resources ([#201](https://github.com/cedricziel/aha-mcp/issues/201)) ([d3a7d24](https://github.com/cedricziel/aha-mcp/commit/d3a7d24097dc6b351c57cb0dd8f3447fcf7153b7))

## [0.6.2](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.6.1...aha-mcp-v0.6.2) (2026-01-12)


### Bug Fixes

* add test setup preload to release-please workflow ([#199](https://github.com/cedricziel/aha-mcp/issues/199)) ([3c60476](https://github.com/cedricziel/aha-mcp/commit/3c60476d7ddfc064efecb8630dc2925bf9955d41))

## [0.6.1](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.6.0...aha-mcp-v0.6.1) (2026-01-12)


### Bug Fixes

* ResourceTemplate URI matching with SDK PR[#1083](https://github.com/cedricziel/aha-mcp/issues/1083) for query parameters ([#197](https://github.com/cedricziel/aha-mcp/issues/197)) ([2e4b8df](https://github.com/cedricziel/aha-mcp/commit/2e4b8df7420e09f1fe2744a91c8ba7e0b425c80f))

## [0.6.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.5.1...aha-mcp-v0.6.0) (2026-01-12)


### Features

* Add E2E testing with real MCP client and migrate to SDK 1.25.2 APIs ([#195](https://github.com/cedricziel/aha-mcp/issues/195)) ([2615506](https://github.com/cedricziel/aha-mcp/commit/2615506fb97ba234262e71b98f4eab8f051ae8f0))
* add resource discovery with MCP sampling and terminology mapping ([#192](https://github.com/cedricziel/aha-mcp/issues/192)) ([a9ee1bd](https://github.com/cedricziel/aha-mcp/commit/a9ee1bdb367a5dc4bcbfc70e155fe0c12134c53e))


### Bug Fixes

* resolve TypeScript errors and complete SDK 1.25.2 migration ([#196](https://github.com/cedricziel/aha-mcp/issues/196)) ([323a1e8](https://github.com/cedricziel/aha-mcp/commit/323a1e8ef7ac7672dd40ee6e14d6e7b6757cf257))

## [0.5.1](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.5.0...aha-mcp-v0.5.1) (2026-01-12)


### Bug Fixes

* convert 39 resources to ResourceTemplate for proper URI matching ([#190](https://github.com/cedricziel/aha-mcp/issues/190)) ([6cdbfaf](https://github.com/cedricziel/aha-mcp/commit/6cdbfafeb165b64f03eb4b7037f9b8b761b6a31e))

## [0.5.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.4.0...aha-mcp-v0.5.0) (2025-09-30)


### Features

* migrate resources to ResourceTemplate for parameter discovery ([#163](https://github.com/cedricziel/aha-mcp/issues/163)) ([687f72b](https://github.com/cedricziel/aha-mcp/commit/687f72bf739a1a20323eaf64e3f7cc583f8b50d9))


### Bug Fixes

* remove read-only tools that duplicate resources ([#161](https://github.com/cedricziel/aha-mcp/issues/161)) ([c8ea984](https://github.com/cedricziel/aha-mcp/commit/c8ea984531384efe5767db2378696ca6c135154c))

## [0.4.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.3.0...aha-mcp-v0.4.0) (2025-09-30)


### Features

* Add pagination support to all MCP resources with aha-js pagination capabilities ([#158](https://github.com/cedricziel/aha-mcp/issues/158)) ([59a699e](https://github.com/cedricziel/aha-mcp/commit/59a699e7629ebd3a6634445d29e40ea352a840c1))

## [0.3.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.2.0...aha-mcp-v0.3.0) (2025-09-30)


### Features

* add Docker build to release-please workflow for automated image publishing ([#156](https://github.com/cedricziel/aha-mcp/issues/156)) ([e90947f](https://github.com/cedricziel/aha-mcp/commit/e90947f95eaa6a96e307e947cfa2ee7159bec52e))

## [0.2.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.1.1...aha-mcp-v0.2.0) (2025-09-30)


### Features

* ability to include custom fields in the ideas response ([#151](https://github.com/cedricziel/aha-mcp/issues/151)) ([211b478](https://github.com/cedricziel/aha-mcp/commit/211b4789e8043f9d5e9c047677f03fa8714d1f95))
* Add custom fields support as MCP resources ([#155](https://github.com/cedricziel/aha-mcp/issues/155)) ([2c59e14](https://github.com/cedricziel/aha-mcp/commit/2c59e14616620c8dd8df1be2237b1cb14e65504f))

## [0.1.1](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.1.0...aha-mcp-v0.1.1) (2025-09-25)


### Bug Fixes

* grant write permissions for release asset upload ([#146](https://github.com/cedricziel/aha-mcp/issues/146)) ([f57909e](https://github.com/cedricziel/aha-mcp/commit/f57909e5aaa0fbc05674ec200b1832cd8596df69))

## [0.1.0](https://github.com/cedricziel/aha-mcp/compare/aha-mcp-v0.0.1...aha-mcp-v0.1.0) (2025-09-25)


### Features

* add Bearer token authentication for SSE mode ([#89](https://github.com/cedricziel/aha-mcp/issues/89)) ([c4956ad](https://github.com/cedricziel/aha-mcp/commit/c4956ad238634d81aaa9e25894e39a9ea3138cb9))
* add Claude Desktop MCP client configuration and clean up dependabot ([f3fb881](https://github.com/cedricziel/aha-mcp/commit/f3fb88186cadf9bab3776d13ee318e1f2647f27e))
* add comprehensive Docker support with multi-platform builds ([1bd6811](https://github.com/cedricziel/aha-mcp/commit/1bd681198fd80eb1fc87562f06ce3005ed42ff45))
* add comprehensive domain-specific prompt library ([e0afda1](https://github.com/cedricziel/aha-mcp/commit/e0afda166f0b047ebc131db1daa80d297dabccbb))
* add Desktop Extensions (DXT) packaging support ([#145](https://github.com/cedricziel/aha-mcp/issues/145)) ([8a15eff](https://github.com/cedricziel/aha-mcp/commit/8a15efff43863b09ce6f1ee020c9c3e7073ded59))
* add foundational resources (products, initiatives, ideas-by-product) ([fe5e581](https://github.com/cedricziel/aha-mcp/commit/fe5e581f0f12d57a04a9ff0716fb3118fb3a9771))
* add package publishing, tests, and npx support ([703efa6](https://github.com/cedricziel/aha-mcp/commit/703efa66c32b2c9328d09df78af7d22cc5437699))
* add semantic commit enforcement ([eaa1e1b](https://github.com/cedricziel/aha-mcp/commit/eaa1e1bdcc56bf15304c470e0567737187e38061))
* complete aha-js 1.2.1 migration and add comprehensive resource coverage ([#93](https://github.com/cedricziel/aha-mcp/issues/93)) ([fa10bf3](https://github.com/cedricziel/aha-mcp/commit/fa10bf3aaaa8fc297d85fdf30ff7330150a84bb2))
* complete initiative MCP tools and update Phase 8 documentation ([74b2e84](https://github.com/cedricziel/aha-mcp/commit/74b2e84644427204acbb5be163190b989f9a624d))
* complete phase 4.3 - add requirements and todos api support ([430b747](https://github.com/cedricziel/aha-mcp/commit/430b7470b4909aa6808e362deb908d57a80b9935))
* complete phase 7b - implement relationship management tools ([d1372d0](https://github.com/cedricziel/aha-mcp/commit/d1372d06ca5e65af1537d533bbf6edc5bc0bf8ac))
* complete Phase 8A - comprehensive CRUD operations for features, epics, and ideas ([f8d6a6a](https://github.com/cedricziel/aha-mcp/commit/f8d6a6a7294fe3bbe6a5df51d674c47da2b8a17e))
* complete Phase 8B - competitor and initiative management tools ([dfd0dd3](https://github.com/cedricziel/aha-mcp/commit/dfd0dd356d12940d74d2a60013bf5848ea9ad488))
* complete Phase 8C - portal integration and advanced features ([7cbe43f](https://github.com/cedricziel/aha-mcp/commit/7cbe43fca202c50ab571a8335311a441348550b5))
* configure GitHub Container Registry publishing and enable Bun support ([5905915](https://github.com/cedricziel/aha-mcp/commit/59059158c4e43f7d5120afb3b3a066dc23d09295))
* expand MCP resource coverage with comprehensive test suite ([2c8b6ff](https://github.com/cedricziel/aha-mcp/commit/2c8b6ffb94b738b110db38e0bd73295d5cc11355))
* implement comprehensive comment system (Phase 2) ([82e3c05](https://github.com/cedricziel/aha-mcp/commit/82e3c05680efda261bda06740265656acb8f2cd2))
* implement comprehensive server health monitoring and diagnostics ([5768bc7](https://github.com/cedricziel/aha-mcp/commit/5768bc777c6ebc82d894c76324b1c43ad74326b0))
* implement comprehensive TypeScript typing system ([b74d052](https://github.com/cedricziel/aha-mcp/commit/b74d05240687177dc672dc33712f5838e498da89))
* implement Goals API with comprehensive resource coverage (Phase 3.1) ([19d4855](https://github.com/cedricziel/aha-mcp/commit/19d4855373f10b5d36ed7a664cbe277fc9c99b85))
* implement phase 7a - add missing sdk api classes and entities ([4d616ac](https://github.com/cedricziel/aha-mcp/commit/4d616ac8ed8ae3f8554d5b3e6acbdef2231406d6))
* implement phase 7b - enhance filtering and update documentation ([ead9122](https://github.com/cedricziel/aha-mcp/commit/ead9122133d167cd861783541f3425541e31c7b5))
* implement Releases API with comprehensive resource coverage (Phase 3.2) ([683c99f](https://github.com/cedricziel/aha-mcp/commit/683c99f7208633076e9fb1852c4cd63fc35e1cf2))
* implement runtime configuration management system ([fa0af34](https://github.com/cedricziel/aha-mcp/commit/fa0af34fa07221d62b662d12d18dee2a38924ccf))
* implement unified entry point with transport mode switching ([b76eefb](https://github.com/cedricziel/aha-mcp/commit/b76eefbba80568a6e348f55bd0fe8759333010e3))
* integrate prompts with existing resources for context-aware responses ([c0570b5](https://github.com/cedricziel/aha-mcp/commit/c0570b52c6f714d4e1f0c668b669ab5c142f2677))
* migrate to Bun-only workflow and remove npm dependencies ([66bb3e5](https://github.com/cedricziel/aha-mcp/commit/66bb3e5768488c10d9dbdb2eb218674c509ffd4a))
* OpenTelemetry observability and SQLite vector database integration ([#99](https://github.com/cedricziel/aha-mcp/issues/99)) ([a2f20a2](https://github.com/cedricziel/aha-mcp/commit/a2f20a290aaa37c185e5dea5d824fb7a45871812))
* simplify release-please setup ([c36f489](https://github.com/cedricziel/aha-mcp/commit/c36f489b4ce5a0e17f3b6843fea93b9fd6bf3a62))


### Bug Fixes

* bun update ([06c3f1c](https://github.com/cedricziel/aha-mcp/commit/06c3f1c3c4b5352414a8631312d8900190bca0e1))
* copy database schema.sql file to Docker build output ([#105](https://github.com/cedricziel/aha-mcp/issues/105)) ([a633d0d](https://github.com/cedricziel/aha-mcp/commit/a633d0dfb2e64f454320e9814f2b13ef0cdf0f65))
* copy schema.sql to exact path expected by database service ([#106](https://github.com/cedricziel/aha-mcp/issues/106)) ([20b7b7f](https://github.com/cedricziel/aha-mcp/commit/20b7b7fc4b81bfdd1b55c7e02c436d8beeb9e6c8))
* ensure Bearer token authentication is properly configured for Aha.io API ([#95](https://github.com/cedricziel/aha-mcp/issues/95)) ([f01b8d0](https://github.com/cedricziel/aha-mcp/commit/f01b8d0bbff9ac8ddbc14036070f5ee6fed6b003))
* improve test reliability and pre-commit hook ([e13c812](https://github.com/cedricziel/aha-mcp/commit/e13c8123d3d5f24361195027509f9774d96defe2))
* prevent logger interference with MCP stdio protocol ([ee6845e](https://github.com/cedricziel/aha-mcp/commit/ee6845e51bc7069d1ce5444e488ae49b8a217ca5))
* remove basic authentication support after aha-js library update ([#94](https://github.com/cedricziel/aha-mcp/issues/94)) ([ae168ba](https://github.com/cedricziel/aha-mcp/commit/ae168ba6c9fc3ec3ed32aad3d523de54196270a2))
* resolve Docker permission denied error for /app/data directory ([#104](https://github.com/cedricziel/aha-mcp/issues/104)) ([badb29a](https://github.com/cedricziel/aha-mcp/commit/badb29af8c6a11433db1a93a46519f5395db041c))
* resolve memory issues and Docker SQLite architecture support ([#101](https://github.com/cedricziel/aha-mcp/issues/101)) ([5f4dd17](https://github.com/cedricziel/aha-mcp/commit/5f4dd1780738a43ba594ab64e5b014b99946b1eb))
* update aha-js library method names after reorganization ([#91](https://github.com/cedricziel/aha-mcp/issues/91)) ([1e6cf26](https://github.com/cedricziel/aha-mcp/commit/1e6cf26d04190e92afef8eecd2838326655c7c70))
* username ([4dd82c6](https://github.com/cedricziel/aha-mcp/commit/4dd82c6562018e2043c4bbbb20b6f085eb299f88))
