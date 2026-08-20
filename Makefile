.PHONY: verify verify-full lint typecheck test-critical test-full

verify: lint typecheck test-critical

verify-full: lint typecheck test-full

lint:
	npm run lint

typecheck:
	npm run typecheck

test-critical:
	npm run test:critical

test-full:
	npm test
