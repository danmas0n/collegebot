import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { costTrackingApi } from '../../utils/api';
import { UserCostSummary, LLMFlowCost, UserCostBreakdown } from '../../types/cost-tracking';
import { PricingConfigManager } from './PricingConfigManager';

interface CostTrackingDashboardProps {}

type SortField = 'totalCost' | 'totalFlows' | 'lastActivity' | 'averageCostPerFlow';
type SortDirection = 'asc' | 'desc';

export const CostTrackingDashboard: React.FC<CostTrackingDashboardProps> = () => {
  const [userSummaries, setUserSummaries] = useState<UserCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('totalCost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserCostBreakdown | null>(null);
  const [userFlows, setUserFlows] = useState<LLMFlowCost[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showPricingConfig, setShowPricingConfig] = useState(false);

  const loadUserSummaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await costTrackingApi.getUsersSummary();
      setUserSummaries(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data');
      console.error('Error loading user summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      setDetailsLoading(true);
      const [breakdown, flows] = await Promise.all([
        costTrackingApi.getUserBreakdown(userId),
        costTrackingApi.getUserFlows(userId)
      ]);
      setUserDetails(breakdown);
      setUserFlows(flows || []);
    } catch (err) {
      console.error('Error loading user details:', err);
      setUserDetails(null);
      setUserFlows([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadUserSummaries();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedUsers = [...userSummaries].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'lastActivity') {
      aValue = aValue ? new Date(aValue).getTime() : 0;
      bValue = bValue ? new Date(bValue).getTime() : 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const totalCost = userSummaries.reduce((sum, user) => sum + user.totalCost, 0);
  const totalFlows = userSummaries.reduce((sum, user) => sum + user.totalFlows, 0);
  const activeUsers = userSummaries.filter(user => user.lastActivity).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStageColor = (stage: string) => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'error' } = {
      recommendations: 'primary',
      map: 'success',
      plan: 'warning',
      research: 'secondary',
      other: 'error',
    };
    return colors[stage] || 'default';
  };

  const toggleRowExpansion = (userId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  const handleUserClick = async (userId: string) => {
    setSelectedUser(userId);
    await loadUserDetails(userId);
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
    setUserDetails(null);
    setUserFlows([]);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={loadUserSummaries}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">LLM Cost Tracking</Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadUserSummaries}
            variant="outlined"
            size="small"
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            startIcon={<SettingsIcon />}
            onClick={() => setShowPricingConfig(true)}
            variant="outlined"
            size="small"
          >
            Pricing Config
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Cost
              </Typography>
              <Typography variant="h4" color="primary">
                {formatCurrency(totalCost)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Flows
              </Typography>
              <Typography variant="h4">
                {totalFlows.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Active Users
              </Typography>
              <Typography variant="h4" color="success.main">
                {activeUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Avg Cost/Flow
              </Typography>
              <Typography variant="h4">
                {formatCurrency(totalFlows > 0 ? totalCost / totalFlows : 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* User Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'totalCost'}
                    direction={sortField === 'totalCost' ? sortDirection : 'asc'}
                    onClick={() => handleSort('totalCost')}
                  >
                    Total Cost
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'totalFlows'}
                    direction={sortField === 'totalFlows' ? sortDirection : 'asc'}
                    onClick={() => handleSort('totalFlows')}
                  >
                    Flows
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'averageCostPerFlow'}
                    direction={sortField === 'averageCostPerFlow' ? sortDirection : 'asc'}
                    onClick={() => handleSort('averageCostPerFlow')}
                  >
                    Avg/Flow
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'lastActivity'}
                    direction={sortField === 'lastActivity' ? sortDirection : 'asc'}
                    onClick={() => handleSort('lastActivity')}
                  >
                    Last Activity
                  </TableSortLabel>
                </TableCell>
                <TableCell>Stages</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers.map((user) => (
                <React.Fragment key={user.userId}>
                  <TableRow hover>
                    <TableCell>
                      <Typography variant="body2">
                        {user.userEmail || `${user.userId.substring(0, 8)}...`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        {formatCurrency(user.totalCost)}
                      </Typography>
                    </TableCell>
                    <TableCell>{user.totalFlows}</TableCell>
                    <TableCell>{formatCurrency(user.averageCostPerFlow)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {formatDate(user.lastActivity)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {Object.entries(user.stageBreakdown).map(([stage, data]) => (
                          <Chip
                            key={stage}
                            label={`${stage}: ${formatCurrency(data.cost)}`}
                            size="small"
                            color={getStageColor(stage)}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Button
                          size="small"
                          onClick={() => handleUserClick(user.userId)}
                        >
                          Details
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(user.userId)}
                        >
                          {expandedRows.has(user.userId) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0 }}>
                      <Collapse in={expandedRows.has(user.userId)}>
                        <Box py={2}>
                          <Typography variant="subtitle2" gutterBottom>
                            Stage Breakdown:
                          </Typography>
                          <Grid container spacing={2}>
                            {Object.entries(user.stageBreakdown).map(([stage, data]) => (
                              <Grid item xs={12} sm={6} md={3} key={stage}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                  <Typography variant="body2" color="textSecondary">
                                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                                  </Typography>
                                  <Typography variant="h6">
                                    {formatCurrency(data.cost)}
                                  </Typography>
                                  <Typography variant="body2">
                                    {data.flows} flows
                                  </Typography>
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* User Details Dialog */}
      <Dialog
        open={!!selectedUser}
        onClose={closeUserDetails}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          User Cost Details: {selectedUser?.substring(0, 8)}...
        </DialogTitle>
        <DialogContent>
          {detailsLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : userDetails ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Stage Breakdown
              </Typography>
              <Grid container spacing={2} mb={3}>
                {Object.entries(userDetails).map(([stage, data]) => (
                  <Grid item xs={12} sm={6} md={4} key={stage}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" color={`${getStageColor(stage)}.main`}>
                          {stage.charAt(0).toUpperCase() + stage.slice(1)}
                        </Typography>
                        <Typography variant="h6">
                          {formatCurrency(data.totalCost)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {data.flowCount} flows • Avg: {formatCurrency(data.averageCostPerFlow)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Typography variant="h6" gutterBottom>
                Recent Flows
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Stage</TableCell>
                      <TableCell>Chat Title</TableCell>
                      <TableCell>Cost</TableCell>
                      <TableCell>Tokens</TableCell>
                      <TableCell>Requests</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userFlows.slice(0, 10).map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell>
                          <Chip
                            label={flow.stage}
                            size="small"
                            color={getStageColor(flow.stage)}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {flow.chatTitle || 'Untitled'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(flow.totalEstimatedCost)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {(flow.totalInputTokens + flow.totalOutputTokens).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>{flow.requestCount}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="textSecondary">
                            {formatDate(flow.createdAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Typography>No details available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUserDetails}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Pricing Config Dialog */}
      <Dialog
        open={showPricingConfig}
        onClose={() => setShowPricingConfig(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>Pricing Configuration</DialogTitle>
        <DialogContent>
          <PricingConfigManager />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPricingConfig(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
