# Playwright Testing Guide for Skamstrup Fleet Desk

This guide enables Claude to interact with and test the admin platform UI using Playwright.

## Prerequisites

The admin platform must be running:
```bash
cd admin-platform && docker-compose up -d
```

Verify services are available:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Basic Usage Pattern

All Playwright scripts follow this structure:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # ... actions here ...

    browser.close()
```

## UI Structure & Selectors

### Navigation Tabs
```python
# Switch to MQTT Devices tab
page.click('button:has-text("MQTT Devices")')

# Switch to Legacy DB tab
page.click('button:has-text("Legacy DB")')
```

### Customer Management
```python
# Add a new customer
page.fill('input[placeholder="Customer name"]', 'Kunde Navn')
page.fill('input[placeholder="Contact name"]', 'Kontakt Person')
page.fill('input[placeholder="Email"]', 'email@example.com')
page.fill('input[placeholder="Phone"]', '12345678')
page.click('button:has-text("Add Customer")')
```

### Device Cards (MQTT Devices)
Each device card contains these sections:
- **Header**: Device ID, IP, status badges (ONLINE/OFFLINE, APPROVED/PENDING)
- **Vitals**: CPU temp, Load, Memory, Uptime
- **Connectivity**: IP, SSID, Display URL, Last seen
- **Location**: Label, Address, ZIP, coordinates, Notes
- **Customer**: Dropdown to assign customer
- **Quick Actions**: Reboot, Restart Node-RED, Restart Chromium
- **Reverse SSH**: Tunnel configuration
- **Remote Access**: Node-RED and Web SSH buttons
- **Diagnostics**: Screenshot, WiFi Scan, Get Info, Log Tail
- **Set Display URL**: Input field + Set URL button
- **Latest Screenshot**: Base64 image display

### Quick Actions
```python
# Reboot device
page.click('button:has-text("Reboot")')

# Restart Node-RED
page.click('button:has-text("Restart Node-RED")')

# Restart Chromium
page.click('button:has-text("Restart Chromium")')
```

### Diagnostics
```python
# Take screenshot from device
page.click('button:has-text("Screenshot")')

# Run WiFi scan
page.click('button:has-text("WiFi Scan")')

# Get device info
page.click('button:has-text("Get Info")')

# Get recent logs
page.click('button:has-text("Log Tail")')
```

### Set Display URL
```python
# Change the display URL
page.fill('input[placeholder="https://example.com"]', 'https://new-url.com')
page.click('button:has-text("Set URL")')
```

### Location Management
```python
# Fill location fields (inside a device card)
page.fill('input[placeholder="Test Spot"]', 'Ny Lokation')
page.fill('input[placeholder="Address or note"]', 'Gadenavn 123')
page.fill('input[placeholder="ZIP"]', '4100')
# Latitude and Longitude fields
page.click('button:has-text("Save Location")')
```

### SSH Tunnel Controls
```python
# Start reverse SSH tunnel
page.click('button:has-text("Start Tunnel")')

# Stop tunnel
page.click('button:has-text("Stop Tunnel")')

# Open Node-RED via tunnel
page.click('button:has-text("Open Node-RED (Tunnel)")')

# Open Web SSH via tunnel
page.click('button:has-text("Open Web SSH (Tunnel)")')
```

## Common Test Scenarios

### 1. Take Screenshot and Save It
```python
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Click Screenshot button
    page.click('button:has-text("Screenshot")')

    # Wait for screenshot to load (device needs time to capture)
    time.sleep(5)
    page.wait_for_load_state('networkidle')

    # Save page screenshot
    page.screenshot(path='/tmp/after-screenshot.png', full_page=True)

    browser.close()
```

### 2. Check Device Status
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Get all device cards
    devices = page.locator('.device-card').all()
    print(f"Found {len(devices)} devices")

    # Check for online status
    online_badges = page.locator('text=ONLINE').all()
    print(f"Online devices: {len(online_badges)}")

    # Get CPU temperature text
    vitals = page.locator('text=/\\d+\\.\\d+C/').first
    if vitals:
        print(f"CPU Temp: {vitals.text_content()}")

    browser.close()
```

### 3. Switch to Legacy DB and List Devices
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Switch to Legacy DB tab
    page.click('button:has-text("Legacy DB")')
    page.wait_for_load_state('networkidle')

    # Take screenshot of legacy view
    page.screenshot(path='/tmp/legacy-db.png', full_page=True)

    browser.close()
```

### 4. Full Page Screenshot with Scroll
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Full page screenshot captures everything
    page.screenshot(path='/tmp/full-page.png', full_page=True)

    browser.close()
```

### 5. Verify API Response via UI
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})

    # Intercept API calls
    responses = []
    page.on('response', lambda r: responses.append(r) if '/devices' in r.url else None)

    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Check API responses
    for r in responses:
        if r.status == 200:
            print(f"API OK: {r.url}")
        else:
            print(f"API Error: {r.url} - {r.status}")

    browser.close()
```

## Waiting Strategies

Always wait appropriately for dynamic content:

```python
# Wait for network to be idle (recommended for initial load)
page.wait_for_load_state('networkidle')

# Wait for specific element
page.wait_for_selector('button:has-text("Reboot")')

# Wait for element to be visible
page.wait_for_selector('.device-card', state='visible')

# Fixed timeout (use sparingly)
page.wait_for_timeout(2000)  # 2 seconds

# Wait for API response after action
with page.expect_response('**/devices/**') as response_info:
    page.click('button:has-text("Refresh")')
response = response_info.value
```

## Error Handling

```python
from playwright.sync_api import sync_playwright, TimeoutError

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        page.goto('http://localhost:3000', timeout=10000)
        page.wait_for_load_state('networkidle')
    except TimeoutError:
        print("Error: Frontend not responding")
        page.screenshot(path='/tmp/error.png')
    finally:
        browser.close()
```

## Tips for Claude

1. **Always take screenshots** after actions to verify results
2. **Use `networkidle`** wait after navigation and clicks that trigger API calls
3. **Device actions take time** - wait 3-5 seconds after Screenshot, WiFi Scan, etc.
4. **Full page screenshots** capture scrollable content
5. **Check for error messages** in the UI after actions
6. **The UI auto-refreshes every 8 seconds** - be aware of timing

## File Locations

- Screenshots: Save to `/tmp/` for easy access
- Frontend source: `admin-platform/frontend/src/App.jsx`
- Styles: `admin-platform/frontend/src/styles.css`
- API client: `admin-platform/frontend/src/api.js`
