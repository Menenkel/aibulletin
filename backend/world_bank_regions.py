import csv
import os

# Load World Bank regions from CSV file
def load_world_bank_regions():
    """Load World Bank regions from the CSV file."""
    regions = {}
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'world_bank_regions.csv')
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                region = row['Region']
                country = row['Country']
                if region not in regions:
                    regions[region] = []
                regions[region].append(country)
        return regions
    except FileNotFoundError:
        # Fallback to hardcoded regions if CSV is not found
        return get_fallback_regions()

def get_fallback_regions():
    """Fallback regions mapping if CSV file is not available."""
    return {
        "Latin America & Caribbean": [
            "Mexico", "Belize", "Guatemala", "Honduras", "El Salvador", "Nicaragua", 
            "Costa Rica", "Panama", "Colombia", "Venezuela", "Ecuador", "Peru", 
            "Brazil", "Bolivia", "Paraguay", "Chile", "Argentina", "Uruguay", 
            "The Bahamas", "Barbados", "Cuba", "Dominican Republic", "Grenada", 
            "Haiti", "Jamaica", "Saint Kitts and Nevis", "Saint Lucia", 
            "Saint Vincent and the Grenadines", "Suriname", "Trinidad and Tobago", "Guyana"
        ],
        "Europe & Central Asia": [
            "Albania", "Andorra", "Armenia", "Austria", "Azerbaijan", "Belarus", 
            "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", 
            "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Georgia", 
            "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", 
            "Kazakhstan", "Kosovo", "Kyrgyzstan", "Latvia", "Liechtenstein", 
            "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", 
            "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", 
            "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", 
            "Spain", "Sweden", "Switzerland", "Tajikistan", "Turkey", "Turkmenistan", 
            "Ukraine", "United Kingdom", "Uzbekistan"
        ],
        "Middle East & North Africa": [
            "Algeria", "Bahrain", "Djibouti", "Egypt", "Iran", "Iraq", "Israel", 
            "Jordan", "Kuwait", "Lebanon", "Libya", "Malta", "Morocco", "Oman", 
            "Qatar", "Saudi Arabia", "Syria", "Tunisia", "United Arab Emirates", 
            "West Bank and Gaza", "Yemen"
        ],
        "Sub-Saharan Africa": [
            "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", 
            "Cameroon", "Central African Republic", "Chad", "Comoros", "Congo", 
            "Democratic Republic of the Congo", "Côte d'Ivoire", "Equatorial Guinea", 
            "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", 
            "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Madagascar", "Malawi", 
            "Mali", "Mauritania", "Mauritius", "Mozambique", "Namibia", "Niger", 
            "Nigeria", "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", 
            "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", 
            "Togo", "Uganda", "Tanzania", "Zambia", "Zimbabwe"
        ],
        "East Asia & Pacific": [
            "Australia", "Brunei Darussalam", "Cambodia", "China", "Fiji", 
            "Indonesia", "Japan", "Kiribati", "Lao PDR", "Malaysia", 
            "Marshall Islands", "Micronesia", "Mongolia", "Myanmar", "Nauru", 
            "New Zealand", "Palau", "Papua New Guinea", "Philippines", 
            "Republic of Korea", "Samoa", "Singapore", "Solomon Islands", 
            "Thailand", "Timor-Leste", "Tonga", "Tuvalu", "Vanuatu", "Vietnam", 
            "Hong Kong SAR, China", "Macao SAR, China"
        ],
        "South Asia": [
            "Afghanistan", "Bangladesh", "Bhutan", "India", "Maldives", 
            "Nepal", "Pakistan", "Sri Lanka"
        ]
    }

# Load regions
WORLD_BANK_REGIONS = load_world_bank_regions()

def get_region_for_country(country_name):
    """Get the World Bank region for a given country name."""
    for region, countries in WORLD_BANK_REGIONS.items():
        if country_name in countries:
            return region
    return "Global Overview"  # Default for countries not in specific regions

def create_regional_prompt(region_name, custom_prompt=""):
    """Create a specialized prompt for regional analysis."""
    if region_name == "Global Overview":
        countries_text = "all countries worldwide"
    else:
        countries = WORLD_BANK_REGIONS.get(region_name, [])
        countries_text = ", ".join(countries[:10])  # Show first 10 countries as examples
    
    # Use custom prompt if provided, otherwise use default regional analysis
    if custom_prompt and custom_prompt.strip():
        base_prompt = f"""You are analyzing information specifically for the {region_name} region. 
        
Focus ONLY on information relevant to countries in this region: {countries_text}

User's specific request: {custom_prompt}

For the {region_name} region, provide analysis based on the user's request while maintaining focus on regional relevance. Provide the output as plain text without any headlines, numbered sections, or formatting."""
    else:
        base_prompt = f"""You are analyzing information specifically for the {region_name} region. 
        
Focus ONLY on information relevant to countries in this region: {countries_text}

For the {region_name} region, provide a comprehensive analysis using EXACTLY these four section headers in this exact order:

Current Drought Conditions: [Your analysis of current drought status, severity, affected areas, and climate patterns in the region]

Food Security and Production: [Your analysis of agricultural production status, food availability, and food security challenges in the region]

Water Resources: [Your analysis of water availability, quality, access, and water-related challenges in the region]

Food Prices: [Your analysis of current food price trends, inflation, and market conditions affecting food affordability in the region]

IMPORTANT: You MUST use these exact section headers with colons. Do not add any additional formatting, numbering, or other headers. Extract and synthesize information that is specifically relevant to {region_name}. If information is not clearly related to this region, exclude it from your analysis."""
    
    return base_prompt

def get_all_regions():
    """Get list of all World Bank regions."""
    return ["Global Overview"] + list(WORLD_BANK_REGIONS.keys())

REGIONS = [
    "East Asia and Pacific",
    "Europe and Central Asia",
    "Latin America/Caribbean",
    "South Asia",
    "Sub-Saharan Africa"
] 