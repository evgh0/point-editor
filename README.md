# Deck.gl Scatter Plot - Obsidian Style

A web application to visualize 2D datapoints from an Excel file using `deck.gl`.

## Features
- **Excel Parsing**: Load `.xlsx` or `.xls` files directly.
- **Scatter Plot**: Interactive 2D visualization with `deck.gl`.
- **Obsidian Style**: Dark theme with clean UI and purple accents.
- **Data Access**: All point information is loaded into a `DataPoint[]` array for further operations.
- **Selection & Filtering**: Select points using box selection or click. Filter data by range.
- **Export Data**: Export all points or only selected points to a new Excel file, preserving modifications.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```

3.  **Upload Data**:
    - Click the "Upload XLSX" button.
    - Select an Excel file where the first three columns are `X`, `Y`, and `Value`.
    - The plot will automatically center on your data.

## Data Format
The application expects an Excel file with at least three columns:
1.  **X**: Horizontal coordinate.
2.  **Y**: Vertical coordinate.
3.  **Value**: Used for point radius.

Additional columns are preserved in the `originalData` property of each point.

## Sample Data
A `sample_data.xlsx` file is provided in the root directory for testing.

```
