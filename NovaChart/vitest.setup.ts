import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Ensure React is available globally for JSX
if (typeof globalThis.React === 'undefined') {
  globalThis.React = React;
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});

