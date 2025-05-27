import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TargetIcon from '@mui/icons-material/GpsFixed';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import BalanceIcon from '@mui/icons-material/Balance';
import WarningIcon from '@mui/icons-material/Warning';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SportsIcon from '@mui/icons-material/Sports';

const TipsAdvicePanel: React.FC = () => {
  const [expanded, setExpanded] = useState<string | false>('privacy');

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TipsAndUpdatesIcon color="primary" />
          College Application Strategy Guide
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>Level the Playing Field:</strong> Colleges use sophisticated algorithms to track your behavior and optimize pricing. 
          This guide helps you navigate the system strategically.
        </Alert>
      </Box>

      {/* Privacy & Digital Strategy */}
      <Accordion expanded={expanded === 'privacy'} onChange={handleChange('privacy')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SecurityIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">Privacy & Digital Strategy</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Reality Check:</strong> Colleges track up to 200 variables about your digital behavior, 
              including clicks, time spent on pages, email opens, and form submissions.
            </Alert>
            
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
              🔍 How You're Being Tracked
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Real-time monitoring of website visits, clicks, and time spent"
                  secondary="Colleges use this to gauge your interest level and ability to pay"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Email engagement tracking (opens, clicks, forwards)"
                  secondary="They know if you're reading their emails and which links you click"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Form submission behavior and partial completions"
                  secondary="Even if you don't submit, they track what you fill out"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              🛡️ Strategic Digital Behavior
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Use separate email addresses for college communications"
                  secondary="Consider a dedicated email just for college applications"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Be strategic about when you show interest"
                  secondary="Don't visit college websites obsessively - it signals desperation"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Use private browsing for initial research"
                  secondary="Save tracked visits for when you want to signal genuine interest"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Time your engagement strategically"
                  secondary="Show interest closer to application deadlines, not months early"
                />
              </ListItem>
            </List>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Financial Aid Reality Check */}
      <Accordion expanded={expanded === 'financial'} onChange={handleChange('financial')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <AttachMoneyIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">Financial Aid Reality Check</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>The 56% Discount Truth:</strong> Private colleges discount tuition by an average of 56%, 
              meaning sticker prices are largely fictional. Focus on net price, not list price.
            </Alert>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
              💰 Understanding the Pricing Game
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Merit scholarships often go to affluent families who don't need them"
                  secondary="This is revenue optimization, not access improvement"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Colleges sort families into 40+ pricing 'cells'"
                  secondary="Your price is determined by ability to pay vs. academic merit matrix"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="'Presidential scholarships' are often just discounts"
                  secondary="Fancy names don't change that you're still paying more than others"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              🎯 Smart Financial Strategies
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Always ask for net price, not sticker price"
                  secondary="What will you actually pay after all aid?"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Negotiate after May 1st if needed"
                  secondary="Many families successfully get better offers by asking"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Compare schools' actual aid distribution"
                  secondary="Look at Common Data Set info, not marketing materials"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Distinguish merit aid from need-based aid"
                  secondary="Need-based aid is more predictable and equitable"
                />
              </ListItem>
            </List>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Strategic Application Approach */}
      <Accordion expanded={expanded === 'strategy'} onChange={handleChange('strategy')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TargetIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">Strategic Application Approach</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              🎯 Understanding Yield Management
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Colleges use 'yield management' like airlines"
                  secondary="They predict who will accept offers and price accordingly"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Your position in their algorithm affects your price"
                  secondary="High-stats students from wealthy areas often pay more"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              🚩 Red Flags in College Marketing
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Heavy emphasis on merit scholarships over need-based aid"
                  secondary="This often means they prioritize revenue over access"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Aggressive marketing to affluent ZIP codes"
                  secondary="Round-the-clock email campaigns targeting wealthy families"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Instant admission offers with scholarships"
                  secondary="These are often revenue optimization tactics"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              ✅ Smart Application Tactics
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Apply to schools with strong need-based aid commitments"
                  secondary="Look for schools that meet 100% of demonstrated need"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Research schools' actual aid policies, not marketing"
                  secondary="Check Common Data Set and financial aid websites"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Don't show desperation in your digital behavior"
                  secondary="Colleges track this and may offer less aid"
                />
              </ListItem>
            </List>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Data & Research Tips */}
      <Accordion expanded={expanded === 'research'} onChange={handleChange('research')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <AnalyticsIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">Data & Research Tips</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              📊 Finding Real Data vs. Marketing
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Use Common Data Set (CDS) information"
                  secondary="Search '[College Name] Common Data Set' for real statistics"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Look at Section H (Financial Aid) in CDS"
                  secondary="Shows actual aid distribution, not marketing claims"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Check net price calculators, but be skeptical"
                  secondary="These often underestimate actual costs"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              🔍 Questions That Reveal True Priorities
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="What percentage of aid is need-based vs. merit-based?"
                  secondary="Higher need-based percentage = more equitable"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="What's the average debt of graduates by family income?"
                  secondary="Shows if low-income students are truly supported"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Do you meet 100% of demonstrated financial need?"
                  secondary="And is it with grants or loans?"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              ⚠️ Warning Signs to Watch For
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="High percentage of students paying full price"
                  secondary="Suggests they prioritize wealthy students"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Large merit scholarships to high-income families"
                  secondary="Revenue optimization over access"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary="Vague answers about aid policies"
                  secondary="Transparency indicates genuine commitment to access"
                />
              </ListItem>
            </List>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Athletics & Recruitment */}
      <Accordion expanded={expanded === 'athletics'} onChange={handleChange('athletics')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SportsIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">Athletics & Recruitment</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Hidden Advantage:</strong> Even if you're not a traditionally recruited high-level athlete, 
              athletics can be a significant tiebreaker, especially at non-Division 1 schools.
            </Alert>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              🏆 Athletics as a Tiebreaker
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Non-Division 1 schools often value athletic participation"
                  secondary="Division II, III, and NAIA schools appreciate well-rounded students"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Coach relationships can open doors"
                  secondary="Coaches often have influence in admissions decisions"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Athletic participation demonstrates commitment"
                  secondary="Shows time management, teamwork, and dedication"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              💰 Financial Benefits
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Early acceptance opportunities"
                  secondary="Coaches may advocate for early admission decisions"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Preferential treatment on merit aid"
                  secondary="Athletic participation can tip merit scholarship decisions"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Walk-on opportunities"
                  secondary="Even without recruitment, you may earn a spot on the team"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Partial scholarships at smaller schools"
                  secondary="Division II and NAIA schools often have more flexibility"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              📞 How to Connect with Coaches
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Research coaching staff and program culture"
                  secondary="Understand their recruiting needs and team philosophy"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Send a professional introduction email"
                  secondary="Include athletic resume, academic stats, and highlight video"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Attend camps or showcases if possible"
                  secondary="Face-to-face interaction can make a lasting impression"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Follow up consistently but respectfully"
                  secondary="Show continued interest without being pushy"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              🎯 Strategic Considerations
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Consider the time commitment vs. academic goals"
                  secondary="Balance athletic participation with academic success"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Look beyond just Division I opportunities"
                  secondary="Division II, III, and NAIA can offer excellent experiences"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Athletic participation enhances college experience"
                  secondary="Built-in community, leadership opportunities, and lifelong friendships"
                />
              </ListItem>
            </List>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Equity-Conscious Choices */}
      <Accordion expanded={expanded === 'equity'} onChange={handleChange('equity')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <BalanceIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">Equity-Conscious Choices</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Making Ethical Choices:</strong> Your college choice can support institutions that prioritize 
              access and equity over revenue optimization.
            </Alert>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              🌟 Schools That Prioritize Access
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Schools with strong need-based aid commitments"
                  secondary="Look for 'need-blind' admissions and 'meets full need' policies"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Public universities with strong in-state support"
                  secondary="Often provide excellent education at lower cost"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Schools with income-based aid thresholds"
                  secondary="Free tuition for families under certain income levels"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              ⚖️ Understanding Merit Aid's Impact
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Merit aid often perpetuates inequality"
                  secondary="It typically goes to students who already have advantages"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Need-based aid is more equitable"
                  secondary="It helps students who actually need financial support"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Your choice sends a message"
                  secondary="Supporting access-focused schools encourages better practices"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
              🎯 True Value Assessment
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Look beyond rankings to actual outcomes"
                  secondary="Employment rates, graduate school acceptance, debt levels"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Consider the full four-year cost"
                  secondary="Not just first-year aid packages"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Evaluate support systems for success"
                  secondary="Academic support, career services, alumni networks"
                />
              </ListItem>
            </List>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Paper sx={{ p: 2, mt: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          💡 Remember: Knowledge is power. Understanding how the system works helps you make informed decisions 
          that align with your values and financial needs.
        </Typography>
      </Paper>
    </Box>
  );
};

export default TipsAdvicePanel;
