# GoOrderly.ai - Testing Guide

## Test-Driven Development Approach

This project follows TDD principles: **Red → Green → Refactor**

### Test Structure

```
tests/
├── unit/                    # Unit tests for individual functions
│   ├── services/
│   ├── utils/
│   └── helpers/
├── integration/             # Integration tests for API endpoints
│   ├── api/
│   └── services/
└── e2e/                     # End-to-end tests
```

## Running Tests

### Watch Mode (Development)
```bash
npm test
```

### Coverage Report
```bash
npm run test:coverage
```

### CI Mode (No Watch)
```bash
npm run test:ci
```

## Writing Tests

### Test Naming Convention
- Files: `*.test.js` or `*.spec.js`
- Location: Co-located with source or in `__tests__` folder

### Example Test Structure
```javascript
describe('JournalService', () => {
  describe('createDailyJournal', () => {
    it('should create a new journal document', async () => {
      // Arrange
      const date = '2025-01-15';
      
      // Act
      const result = await journalService.createDailyJournal(date);
      
      // Assert
      expect(result).toHaveProperty('id');
      expect(result.title).toContain(date);
    });
  });
});
```

## Test Categories

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Fast execution (< 100ms per test)

### Integration Tests
- Test API endpoints
- Test service interactions
- May use test database

### E2E Tests
- Test complete user flows
- Use real services (or close mocks)
- Slower execution

## Coverage Goals

- **Unit Tests**: > 80% coverage
- **Integration Tests**: > 60% coverage
- **Critical Paths**: 100% coverage

## Mocking Strategy

- Use Jest mocks for external APIs
- Use test doubles for database
- Use fixtures for sample data

