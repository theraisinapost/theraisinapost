/** Report-only score baselines; editorial performance is measured, not guessed. */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'python3 -m http.server 8731 --bind 127.0.0.1 --directory dist',
      startServerReadyPattern: 'Serving HTTP on',
      startServerReadyTimeout: 20000,
      url: [
        'http://127.0.0.1:8731/',
        'http://127.0.0.1:8731/about.html',
        'http://127.0.0.1:8731/publication-guide.html'
      ],
      numberOfRuns: 1,
      settings: {
        chromeFlags: '--headless --no-sandbox'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.65 }],
        'categories:accessibility': ['warn', { minScore: 0.85 }],
        'categories:best-practices': ['warn', { minScore: 0.80 }],
        'categories:seo': ['warn', { minScore: 0.85 }]
      }
    },
    upload: { target: 'filesystem', outputDir: './lighthouse-reports' }
  }
};
