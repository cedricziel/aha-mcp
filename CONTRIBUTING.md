# Contributing to @cedricziel/aha-mcp

Thank you for considering contributing to this project! Here are some guidelines to help you get started.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/aha-mcp.git`
3. Install dependencies: `bun install`
4. Set up environment variables:
   ```bash
   export AHA_COMPANY="your-company"
   export AHA_TOKEN="your-api-token"
   ```

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) specification. All commit messages must follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

### Examples

```bash
feat: add new MCP tool for listing projects
fix: resolve authentication issue with API tokens
docs: update README with installation instructions
feat!: change API response format (breaking change)
```

### Validation

- Commit messages are validated locally using husky and commitlint
- CI will also validate all commit messages in pull requests
- Invalid commit messages will prevent merging

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the coding standards
3. Add tests for new functionality
4. Ensure all tests pass: `bun test`
5. Build the project: `bun run build`
6. Commit your changes using conventional commits
7. Push to your fork and submit a pull request

## Testing

- Run tests: `bun test`
- Run tests in watch mode: `bun test:watch`
- All tests must pass before merging

## Code Style

- Use TypeScript for all new code
- Follow the existing code style and patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Release Process

This project uses automated releases:
- Releases are created automatically based on conventional commits
- Version bumps are determined by commit types (feat = minor, fix = patch, breaking = major)
- Releases are published to npm automatically

## Questions?

If you have questions about contributing, please open an issue or discussion on GitHub.