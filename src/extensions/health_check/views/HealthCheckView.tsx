import * as React from 'react';
import { useSelector } from 'react-redux';
import { IProfile, IState } from '../../../types/IState';
import { Col, Row, Button, ProgressBar, Alert } from 'react-bootstrap';
import MainPage from '../../../views/MainPage';
import FlexLayout from '../../../controls/FlexLayout';
import Spinner from '../../../controls/Spinner';
import { activeGameId, activeProfile } from '../../profile_management/selectors';
import { getHealthCheckRegistry, manualTrigger } from '../index';
import { HealthCheckRegistry } from '../HealthCheckRegistry';
import bbcode from '../../../util/bbcode';
import {
  IHealthCheckResult, 
  IHealthCheckEntry,
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger
} from '../../../types/IHealthCheck';
import { useTranslation } from 'react-i18next';

interface IConnectedProps {
  gameId: string | null;
  profile: IProfile;
}

interface IProps {
  registry?: HealthCheckRegistry;
}

const HealthCheckView: React.FC<IProps> = ({
  registry
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(false);
  const [healthResults, setHealthResults] = React.useState<IHealthCheckResult[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<HealthCheckCategory | 'all'>('all');
  
  const mRegistry = React.useMemo(() => registry || getHealthCheckRegistry(), [registry]);
  const { profile, gameId } = useSelector(mapStateToProps);

  const onHealthCheckResults = React.useCallback((data: { trigger: HealthCheckTrigger; results: IHealthCheckResult[]; summary: any }) => {
    setHealthResults(data.results);
    setSummary(data.summary);
    setLastUpdate(new Date());
    setIsLoading(false);
  }, []);

  const refreshHealthData = React.useCallback(async () => {
    if (!mRegistry) {
      console.warn('Health check registry not available');
      return;
    }

    setIsLoading(true);

    try {
      // Trigger manual health check execution
      const results = await manualTrigger();
      const summaryData = mRegistry.getSummary();
      
      setHealthResults(results);
      setSummary(summaryData);
      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to refresh health data:', error);
      setIsLoading(false);
      
      // Show empty state if health checks fail
      setHealthResults([]);
      setSummary(null);
    }
  }, [mRegistry]);

  React.useEffect(() => {
    refreshHealthData();
    
    // Listen for automatic health check updates with proper null checking
    try {
      const api = mRegistry?.getApi();
      if (api && api.events && typeof api.events.on === 'function') {
        api.events.on('health-check-results', onHealthCheckResults);
      }
    } catch (error) {
      console.warn('Failed to setup health check event listeners:', error);
    }

    return () => {
      try {
        const api = mRegistry?.getApi();
        if (api && api.events && typeof api.events.removeListener === 'function') {
          api.events.removeListener('health-check-results', onHealthCheckResults);
        }
      } catch (error) {
        console.warn('Failed to cleanup health check event listeners:', error);
      }
    };
  }, [mRegistry, onHealthCheckResults, refreshHealthData]);

  React.useEffect(() => {
    // Refresh when game or profile changes
    refreshHealthData();
  }, [gameId, profile?.id, refreshHealthData]);

  const calculateHealthScore = React.useCallback((): number => {
    if (healthResults.length === 0) {
      return 100;
    }
    
    let totalDeductions = 0;
    healthResults.forEach(result => {
      switch (result.status) {
        case 'error':
          totalDeductions += 25;
          break;
        case 'failed':
          totalDeductions += 20;
          break;
        case 'warning':
          totalDeductions += 10;
          break;
        default:
          totalDeductions += 0;
      }
    });
    
    return Math.max(0, 100 - totalDeductions);
  }, [healthResults]);

  const getStatusIcon = React.useCallback((status: string): string => {
    switch (status) {
      case 'passed': return '✅';
      case 'warning': return '⚠️';
      case 'failed': return '❌';
      case 'error': return '🔥';
      default: return '❓';
    }
  }, []);

  const getCategoryDisplayName = React.useCallback((category: HealthCheckCategory): string => {
    switch (category) {
      case HealthCheckCategory.System: return 'System';
      case HealthCheckCategory.Game: return 'Game';
      case HealthCheckCategory.Mods: return 'Mods';
      case HealthCheckCategory.Tools: return 'Tools';
      case HealthCheckCategory.Performance: return 'Performance';
      case HealthCheckCategory.Legacy: return 'Legacy Tests';
      default: return 'Other';
    }
  }, []);

  const renderBBCodeContent = React.useCallback((content: string): React.ReactNode => {
    try {
      // Check if content contains BBCode tags
      if (content && (content.includes('[') && content.includes(']'))) {
        return bbcode(content);
      }
      // If no BBCode, return as plain text with line breaks preserved
      return content?.split('\n').map((line, index) => (
        <React.Fragment key={index}>
          {line}
          {index < content.split('\n').length - 1 && <br />}
        </React.Fragment>
      ));
    } catch (error) {
      console.warn('Failed to render BBCode content:', error);
      // Fallback to plain text
      return content;
    }
  }, []);

  const renderHealthScore = React.useCallback(() => {
    const healthScore = calculateHealthScore();
    
    let statusText: string;
    let bsStyle: string;
    
    if (healthScore >= 90) {
      bsStyle = 'success';
      statusText = 'Excellent';
    } else if (healthScore >= 70) {
      bsStyle = 'info';
      statusText = 'Good';
    } else if (healthScore >= 50) {
      bsStyle = 'warning';
      statusText = 'Fair';
    } else {
      bsStyle = 'danger';
      statusText = 'Needs Attention';
    }
    
    return (
      <div className='health-score'>
        <Row>
          <Col md={6}>
            <div className='health-score-main'>
              <h4>{t('System Health Score')}</h4>
              <div className='health-score-display'>
                <div className={`health-score-number health-score-${bsStyle}`}>
                  {healthScore}%
                </div>
                <div className='health-score-status'>
                  {t(statusText)}
                </div>
              </div>
              <ProgressBar 
                now={healthScore} 
                bsStyle={bsStyle}
                className='health-score-progress'
              />
            </div>
          </Col>
          <Col md={6}>
            {summary && (
              <div className='health-summary-stats'>
                <h5>{t('Health Check Summary')}</h5>
                <div className='stats-grid'>
                  <div className='stat-item'>
                    <strong>{summary.total}</strong><br />
                    <small>{t('Total Checks')}</small>
                  </div>
                  <div className='stat-item'>
                    <strong>{summary.enabled}</strong><br />
                    <small>{t('Enabled')}</small>
                  </div>
                  <div className='stat-item stat-item-passed'>
                    <strong>{summary.lastResults.passed}</strong><br />
                    <small>{t('Passed')}</small>
                  </div>
                  <div className='stat-item stat-item-warning'>
                    <strong>{summary.lastResults.warning}</strong><br />
                    <small>{t('Warnings')}</small>
                  </div>
                  <div className='stat-item stat-item-failed'>
                    <strong>{summary.lastResults.failed + summary.lastResults.error}</strong><br />
                    <small>{t('Issues')}</small>
                  </div>
                </div>
                {lastUpdate && (
                  <div className='health-last-update'>
                    {t('Last updated: {{time}}', { replace: { time: lastUpdate.toLocaleTimeString() } })}
                  </div>
                )}
              </div>
            )}
          </Col>
        </Row>
      </div>
    );
  }, [calculateHealthScore, summary, lastUpdate, t]);

  const renderCategoryFilter = React.useCallback(() => {
    if (!summary) return null;

    const categories = [
      { key: 'all', name: t('All Categories'), count: summary.total },
      ...Object.values(HealthCheckCategory).map(cat => ({
        key: cat,
        name: getCategoryDisplayName(cat),
        count: summary.categories[cat] || 0
      })).filter(cat => cat.count > 0)
    ];

    return (
      <div className='category-filter' style={{ marginBottom: '20px' }}>
        <h5>{t('Filter by Category')}</h5>
        <div className='btn-group' role='group'>
          {categories.map(category => (
            <Button
              key={category.key}
              onClick={() => setSelectedCategory(category.key as any)}
              bsStyle={selectedCategory === category.key ? 'primary' : 'default'}
              bsSize='sm'
            >
              {category.name} ({category.count})
            </Button>
          ))}
        </div>
      </div>
    );
  }, [summary, selectedCategory, getCategoryDisplayName, t]);

  const renderHealthCheckResults = React.useCallback(() => {
    if (!mRegistry) {
      return (
        <Alert bsStyle='warning'>
          {t('Health check system not available')}
        </Alert>
      );
    }

    // Filter results by category
    let filteredResults = healthResults;
    if (selectedCategory !== 'all') {
      const allEntries = mRegistry.getByCategory(selectedCategory as HealthCheckCategory);
      const entryIds = new Set(allEntries.map(e => e.healthCheck.id));
      filteredResults = healthResults.filter(result => entryIds.has(result.checkId));
    }

    // Group by category for display
    const categorizedResults: { [category: string]: IHealthCheckResult[] } = {};
    
    filteredResults.forEach(result => {
      const entry = mRegistry!.get(result.checkId);
      if (entry) {
        const category = getCategoryDisplayName(entry.healthCheck.category);
        if (!categorizedResults[category]) {
          categorizedResults[category] = [];
        }
        categorizedResults[category].push(result);
      }
    });

    if (Object.keys(categorizedResults).length === 0) {
      return (
        <div className='health-check-empty'>
          <h5>{t('All Clear!')}</h5>
          <p>{t('No issues detected in the selected category. Your setup appears to be healthy.')}</p>
        </div>
      );
    }

    return Object.keys(categorizedResults).map(category => (
      <div key={category} className='health-category'>
        <h5 className='health-category-title'>
          {category}
        </h5>
        <div className='health-category-items'>
          {categorizedResults[category].map((result, index) => {
            const entry = mRegistry!.get(result.checkId);
            const healthCheck = entry?.healthCheck;
            
            return (
              <div key={index} className={`health-item health-item-${result.status}`}>
                <div className='health-item-header'>
                  <div className='health-item-title'>
                    {getStatusIcon(result.status)} {healthCheck?.name || result.checkId}
                  </div>
                  <div className={`health-item-severity health-severity-${result.severity}`}>
                    {result.severity}
                  </div>
                </div>
                
                {healthCheck?.description && (
                  <div className='health-item-description'>
                    {renderBBCodeContent(healthCheck.description)}
                  </div>
                )}
                
                <div className='health-item-message'>
                  {renderBBCodeContent(result.message)}
                </div>
                
                {result.details && (
                  <div className='health-item-details'>
                    {renderBBCodeContent(result.details)}
                  </div>
                )}
                
                <div className='health-item-meta'>
                  <span>
                    {t('Executed in {{time}}ms', { replace: { time: result.executionTime } })}
                  </span>
                  <span>
                    {result.timestamp.toLocaleString()}
                  </span>
                </div>
                
                {result.fixAvailable && (
                  <div className='health-item-fix'>
                    <Button bsStyle='primary' bsSize='sm'>
                      {t('Apply Fix')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ));
  }, [mRegistry, healthResults, selectedCategory, getCategoryDisplayName, getStatusIcon, t]);

  return (
    <MainPage>
      <MainPage.Header>
        <div className='health-check-header-controls'>
          <div>
            {t('Health Check Dashboard')}
          </div>
          <Button
            title={t('Run all health checks manually')}
            onClick={refreshHealthData}
            disabled={isLoading}
            bsStyle='primary'
          >
            {isLoading ? <Spinner /> : t('Run Health Checks')}
          </Button>
        </div>
      </MainPage.Header>
      <MainPage.Body>
        <FlexLayout type='column'>
          <FlexLayout.Fixed>
            <div className='health-check-header'>
              {renderHealthScore()}
            </div>
          </FlexLayout.Fixed>
          
          <FlexLayout.Fixed>
            {renderCategoryFilter()}
          </FlexLayout.Fixed>
          
          <FlexLayout.Flex>
            <Row>
              <Col>
                <div className='health-check-content'>
                  {isLoading ? (
                    <div className='health-check-loading'>
                      <Spinner />
                      <p>{t('Running health checks...')}</p>
                    </div>
                  ) : (
                    renderHealthCheckResults()
                  )}
                </div>
              </Col>
            </Row>
          </FlexLayout.Flex>
        </FlexLayout>
      </MainPage.Body>
    </MainPage>
  );
};

function mapStateToProps(state: IState): IConnectedProps {
  const gameId = activeGameId(state);
  return {
    gameId,
    profile: activeProfile(state),
  };
}

export default HealthCheckView;