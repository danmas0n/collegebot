import { useState, useMemo } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  TextField
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowParams
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';
import CalculateIcon from '@mui/icons-material/Calculate';
import { MapLocation } from '../../types/wizard';

interface CollegeTableViewProps {
  locations: MapLocation[];
  selectedLocationId?: string;
  onLocationSelect: (locationId: string) => void;
  onRowClick: (location: MapLocation) => void;
}

const getTierColor = (tier?: string): 'error' | 'warning' | 'success' | 'info' | 'default' => {
  switch (tier) {
    case 'reach': return 'error';
    case 'target': return 'warning';
    case 'safety': return 'success';
    case 'likely': return 'info';
    default: return 'default';
  }
};

const getTierLabel = (tier?: string): string => {
  if (!tier || tier === 'uncategorized') return 'Uncategorized';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
};

const formatCurrency = (amount?: number): string => {
  if (!amount) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const CollegeTableView = ({
  locations,
  selectedLocationId,
  onLocationSelect,
  onRowClick
}: CollegeTableViewProps) => {
  // Filter to only colleges
  const colleges = useMemo(() => 
    locations.filter(loc => loc.type === 'college'),
    [locations]
  );

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'School',
      width: 250,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span>{params.value}</span>
        </Box>
      )
    },
    {
      field: 'tier',
      headerName: 'Tier',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={getTierLabel(params.value)}
          color={getTierColor(params.value)}
          size="small"
        />
      )
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 200,
      valueGetter: (_value, row: MapLocation) => {
        return row.metadata?.address || `${row.latitude.toFixed(2)}, ${row.longitude.toFixed(2)}`;
      }
    },
    {
      field: 'coa',
      headerName: 'COA',
      width: 120,
      type: 'number',
      valueGetter: (_value, row: MapLocation) => {
        // Try user-entered first, then CDS data
        return row.metadata?.financial?.costOfAttendance || 
               row.metadata?.costOfAttendance?.total;
      },
      renderCell: (params: GridRenderCellParams) => formatCurrency(params.value)
    },
    {
      field: 'meritAid',
      headerName: 'Merit Aid',
      width: 130,
      renderCell: (params: GridRenderCellParams) => {
        const location = params.row as MapLocation;
        const likelihood = location.metadata?.financial?.meritAidLikelihood;
        
        if (!likelihood) return <span>-</span>;
        
        const colorMap = {
          high: 'success',
          medium: 'warning',
          low: 'default',
          none: 'error'
        } as const;
        
        const labelMap = {
          high: 'High',
          medium: 'Medium',
          low: 'Low',
          none: 'None'
        };
        
        return (
          <Tooltip title={location.metadata?.financial?.meritAidReasoning || 'Merit aid likelihood'}>
            <Chip
              label={labelMap[likelihood]}
              color={colorMap[likelihood]}
              size="small"
            />
          </Tooltip>
        );
      }
    },
    {
      field: 'netPrice',
      headerName: 'Est. Net Price',
      width: 140,
      type: 'number',
      valueGetter: (_value, row: MapLocation) => {
        return row.metadata?.financial?.netPriceEstimate;
      },
      renderCell: (params: GridRenderCellParams) => formatCurrency(params.value)
    },
    {
      field: 'reason',
      headerName: 'Why It\'s a Good Fit',
      width: 200,
      renderCell: (params: GridRenderCellParams) => {
        const location = params.row as MapLocation;
        // Use description field (which contains the fit reasoning) with reason as fallback
        const reason = location.metadata?.description || location.metadata?.reason;

        if (!reason) return <span style={{ color: '#999' }}>-</span>;

        // Truncate to ~50 chars with ellipsis
        const truncated = reason.length > 50 ? reason.substring(0, 50) + '...' : reason;

        return (
          <Tooltip title={reason}>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block'
            }}>
              {truncated}
            </span>
          </Tooltip>
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const location = params.row as MapLocation;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
            <Tooltip title="View on map">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onLocationSelect(location.id);
                }}
              >
                <MapIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Calculate net price">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open('https://collegecost.ed.gov/net-price', '_blank');
                }}
              >
                <CalculateIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }
    }
  ];

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <DataGrid
        rows={colleges}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 }
          },
          sorting: {
            sortModel: [{ field: 'name', sort: 'asc' }]
          }
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        sx={{
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }
        }}
        onRowClick={(params: GridRowParams) => onRowClick(params.row as MapLocation)}
      />
    </Box>
  );
};
