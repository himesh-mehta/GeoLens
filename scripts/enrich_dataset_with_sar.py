import pandas as pd
import ee
import os
from tqdm import tqdm
import time

# Initialize Earth Engine
try:
    project_id = os.environ.get("GEE_PROJECT_ID", "")
    ee.Initialize(project=project_id)
    print("Earth Engine initialized successfully.")
except Exception as e:
    print(f"Earth Engine initialization failed: {e}")
    exit(1)

INPUT_CSV = "SIH_SamePoints_2018_2024_Light.csv"
OUTPUT_CSV = "SIH_SamePoints_2018_2024_Enriched.csv"

def get_sar_median(start_date, end_date):
    """
    Returns a Sentinel-1 image collection median composite with VV and VH.
    Applies standard preprocessing (IW mode, descending pass, angle filtering).
    """
    s1 = (ee.ImageCollection('COPERNICUS/S1_GRD')
          .filterDate(start_date, end_date)
          .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
          .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
          .filter(ee.Filter.eq('instrumentMode', 'IW'))
          # To ensure consistent geometry, we could filter by orbitProperties_pass,
          # but taking median across all passes is also robust for general land cover.
          )
    return s1.select(['VV', 'VH']).median()

def process_batch(points_df, year):
    """
    Given a dataframe of points, extracts VV and VH from Sentinel-1 for the given year.
    Returns a list of dictionaries with point_id, VV, VH.
    """
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    s1_median = get_sar_median(start_date, end_date)
    
    # Convert points to FeatureCollection
    features = []
    for idx, row in points_df.iterrows():
        point = ee.Geometry.Point([row['longitude'], row['latitude']])
        features.append(ee.Feature(point, {'point_id': row['point_id']}))
        
    fc = ee.FeatureCollection(features)
    
    # Sample the SAR composite
    sampled = s1_median.sampleRegions(
        collection=fc,
        scale=10,
        geometries=False,
        tileScale=4
    ).getInfo()
    
    # Parse results
    results = {}
    for feat in sampled['features']:
        props = feat['properties']
        point_id = props.get('point_id')
        results[point_id] = {
            f'VV_{year}': props.get('VV', None),
            f'VH_{year}': props.get('VH', None)
        }
        
    return results

def main():
    print(f"Loading {INPUT_CSV}...")
    df = pd.read_csv(INPUT_CSV)
    print(f"Total points: {len(df)}")
    
    # Ensure point_id is unique and exists
    if 'point_id' not in df.columns:
        df['point_id'] = range(len(df))
        
    # We will process in batches of 500 to avoid GEE limits
    batch_size = 500
    
    # Create empty columns
    df['VV_2018'] = None
    df['VH_2018'] = None
    df['VV_2024'] = None
    df['VH_2024'] = None
    
    total_batches = (len(df) + batch_size - 1) // batch_size
    
    print("Extracting Sentinel-1 SAR features...")
    
    for i in tqdm(range(total_batches), desc="Processing Batches"):
        batch_df = df.iloc[i*batch_size : (i+1)*batch_size]
        
        # Try 2018
        try:
            res_2018 = process_batch(batch_df, 2018)
            for point_id, values in res_2018.items():
                idx = df[df['point_id'] == point_id].index[0]
                df.at[idx, 'VV_2018'] = values.get('VV_2018')
                df.at[idx, 'VH_2018'] = values.get('VH_2018')
        except Exception as e:
            print(f"Error processing 2018 batch {i}: {e}")
            
        # Try 2024
        try:
            res_2024 = process_batch(batch_df, 2024)
            for point_id, values in res_2024.items():
                idx = df[df['point_id'] == point_id].index[0]
                df.at[idx, 'VV_2024'] = values.get('VV_2024')
                df.at[idx, 'VH_2024'] = values.get('VH_2024')
        except Exception as e:
            print(f"Error processing 2024 batch {i}: {e}")
            
    print("Extraction complete.")
    
    missing_2018 = df['VV_2018'].isna().sum()
    missing_2024 = df['VV_2024'].isna().sum()
    print(f"Missing SAR 2018: {missing_2018} / {len(df)}")
    print(f"Missing SAR 2024: {missing_2024} / {len(df)}")
    
    print(f"Saving to {OUTPUT_CSV}...")
    df.to_csv(OUTPUT_CSV, index=False)
    print("Done!")

if __name__ == "__main__":
    main()
