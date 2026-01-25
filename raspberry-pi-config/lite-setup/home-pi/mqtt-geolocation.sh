#!/bin/bash
# Get geolocation via IP using ip-api.com (free, no API key needed)
# Returns JSON with lat, lon, city, region, country
# Works without jq - uses grep/sed for parsing

# Try ip-api.com first (free, 45 requests/minute)
LOCATION=$(curl -s --max-time 10 "http://ip-api.com/json/?fields=status,lat,lon,city,regionName,country,isp,query")

# Parse JSON using bash (no jq required)
parse_json() {
    local key="$1"
    local json="$2"
    # Extract value for key using grep and sed
    echo "$json" | grep -o "\"$key\":[^,}]*" | sed -E 's/.*:[ ]*"?([^",}]*)"?.*/\1/' | head -1
}

STATUS=$(parse_json "status" "$LOCATION")

if [ "$STATUS" = "success" ]; then
    LAT=$(parse_json "lat" "$LOCATION")
    LON=$(parse_json "lon" "$LOCATION")
    CITY=$(parse_json "city" "$LOCATION")
    REGION=$(parse_json "regionName" "$LOCATION")
    COUNTRY=$(parse_json "country" "$LOCATION")
    ISP=$(parse_json "isp" "$LOCATION")
    IP=$(parse_json "query" "$LOCATION")

    echo "{\"status\":\"success\",\"lat\":$LAT,\"lon\":$LON,\"city\":\"$CITY\",\"region\":\"$REGION\",\"country\":\"$COUNTRY\",\"isp\":\"$ISP\",\"ip\":\"$IP\"}"
else
    # Fallback: return error
    echo "{\"status\":\"error\",\"message\":\"Could not determine location\"}"
fi
