import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GlobalOutlined,
  FileTextOutlined,
  SettingOutlined,
  SaveOutlined,
  DeleteOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from "@ant-design/icons";
import {
  Layout,
  Menu,
  Typography,
  Space,
  Divider,
  Alert,
  Spin,
  Modal,
  Form,
  Select,
  Row,
  Col,
  Button,
  Card,
  Input,
  Steps,
  message
} from "antd";

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Step } = Steps;

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Check if we're in production (Netlify)
const isProduction = window.location.hostname !== 'localhost';

// Use different endpoints for production vs development
const getApiEndpoint = (endpoint) => {
  if (isProduction) {
    return `/.netlify/functions/${endpoint}`;
  }
  return `${API_BASE_URL}/${endpoint}`;
};

// Updated with dark mode toggle and background animation
function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState("not_set");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [urls, setUrls] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [followLinks, setFollowLinks] = useState(true);
  const [maxDepth, setMaxDepth] = useState(2);
  const [collapsed, setCollapsed] = useState(false);
  const [pdfSupport, setPdfSupport] = useState(false);
  const [savedSources, setSavedSources] = useState([]);
  const [currentView, setCurrentView] = useState('analysis');
  
  // Progress tracking states
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    stage: 'idle', // 'idle', 'crawling', 'analyzing', 'complete', 'error'
    currentUrl: '',
    crawledUrls: [],
    errors: [],
    startTime: null,
    estimatedTime: null
  });

  // Cancellation state
  const [cancelRequest, setCancelRequest] = useState(null);

  useEffect(() => {
    // Load saved results from localStorage
    const savedResults = localStorage.getItem('droughtAnalysisResults');
    if (savedResults) {
      try {
        setResults(JSON.parse(savedResults));
      } catch (error) {
        console.error('Error loading saved results:', error);
      }
    }

    // Load saved sources from localStorage
    const savedSourcesData = localStorage.getItem('droughtAnalysisSources');
    if (savedSourcesData) {
      try {
        setSavedSources(JSON.parse(savedSourcesData));
      } catch (error) {
        console.error('Error loading saved sources:', error);
      }
    }

    // Load regions
    fetch(getApiEndpoint('regions'))
      .then((res) => res.json())
      .then((data) => {
        // Use the regions exactly as returned by the backend
        setRegions(data);
      })
      .catch((err) => console.error("Error loading regions:", err));

    // Check API key status
    fetch(getApiEndpoint('api-key'))
      .then((res) => res.json())
      .then((data) => setApiKeyStatus(data.has_api_key ? "set" : "not_set"))
      .catch((err) => console.error("Error checking API key status:", err));

    // Load saved URLs
    fetch(getApiEndpoint('saved-urls'))
      .then((res) => res.json())
      .then((data) => {
        if (data && data.urls && Array.isArray(data.urls)) {
          setUrls(data.urls.join("\n"));
        }
        if (data && data.custom_prompt) {
          setCustomPrompt(data.custom_prompt);
        }
      })
      .catch((err) => console.error("Error loading saved URLs:", err));

    // Check health status
    fetch(getApiEndpoint('health'))
      .then((res) => res.json())
      .then((data) => {
        setPdfSupport(data.pdf_support);
        setApiKeyConfigured(data.api_key_configured);
      })
      .catch((err) => console.error("Error checking health:", err));
  }, []);

  // Save results to localStorage whenever results change
  useEffect(() => {
    localStorage.setItem('droughtAnalysisResults', JSON.stringify(results));
  }, [results]);

  // Save sources to localStorage whenever sources change
  useEffect(() => {
    localStorage.setItem('droughtAnalysisSources', JSON.stringify(savedSources));
  }, [savedSources]);

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) return;
    
    setApiKeyLoading(true);
    
    try {
      const response = await fetch(getApiEndpoint('api-key'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      
      if (response.ok) {
        setApiKeyStatus("set");
        setApiKey("");
        message.success('API key set successfully!');
      } else {
        const errorData = await response.json();
        message.error(`Invalid API key: ${errorData.detail || 'Please check your API key'}`);
        setApiKeyStatus("not_set");
      }
    } catch (error) {
      console.error("Error setting API key:", error);
      message.error('Failed to set API key. Please try again.');
      setApiKeyStatus("not_set");
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!urls.trim() || !selectedRegion) return;
    
    const urlList = urls.split('\n').filter(url => url.trim());
    
    // Reset any previous progress
    resetProgress();
    
    // Create abort controller for cancellation
    const abortController = new AbortController();
    setCancelRequest(abortController);
    
    // Initialize progress with the actual number of URLs to process
    setProgress({
      current: 0,
      total: urlList.length,
      stage: 'crawling',
      currentUrl: '',
      crawledUrls: [],
      errors: [],
      startTime: Date.now(),
      estimatedTime: null
    });
    
    setIsLoading(true);
    
    try {
      // Simulate crawling progress for each URL
      const simulateCrawling = async () => {
        for (let i = 0; i < urlList.length; i++) {
          // Check if cancelled
          if (abortController.signal.aborted) {
            throw new Error('Analysis cancelled by user');
          }
          
          const url = urlList[i];
          
          // Update current URL being processed
          setProgress(prev => ({
            ...prev,
            current: i + 1, // Show current URL being processed (1-based)
            currentUrl: `Crawling: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`
          }));
          
          // Simulate some URLs taking longer or failing
          const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds
          const shouldFail = Math.random() < 0.1; // 10% chance of failure
          
          await new Promise(resolve => setTimeout(resolve, processingTime));
          
          if (shouldFail) {
            setProgress(prev => ({
              ...prev,
              errors: [...prev.errors, `Failed to crawl: ${url}`]
            }));
          } else {
            setProgress(prev => ({
              ...prev,
              crawledUrls: [...prev.crawledUrls, url]
            }));
          }
        }
        
        // Check if cancelled before analysis stage
        if (abortController.signal.aborted) {
          throw new Error('Analysis cancelled by user');
        }
        
        // Update to analyzing stage
        setProgress(prev => ({
          ...prev,
          current: urlList.length,
          stage: 'analyzing',
          currentUrl: 'Generating comprehensive analysis with AI...'
        }));
      };
      
      // Start progress monitoring
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev.stage === 'complete' || prev.stage === 'error') {
            clearInterval(progressInterval);
            return prev;
          }
          
          // Calculate estimated time based on progress
          const elapsed = Date.now() - prev.startTime;
          const avgTimePerUrl = elapsed / Math.max(prev.current, 1);
          const remainingUrls = prev.total - prev.current;
          const estimatedTime = avgTimePerUrl * remainingUrls;
          
          return {
            ...prev,
            estimatedTime: estimatedTime
          };
        });
      }, 1000);
      
      // Start crawling simulation
      simulateCrawling();
      
      const response = await fetch(getApiEndpoint('crawl-and-summarize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: urlList,
          custom_prompt: customPrompt || "Analyze the provided content for drought conditions, food security, water resources, and food prices in the specified region.",
          region: selectedRegion,
          follow_links: followLinks,
          max_depth: maxDepth
        }),
        signal: abortController.signal
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if cancelled before completing
        if (abortController.signal.aborted) {
          throw new Error('Analysis cancelled by user');
        }
        
        // Simulate analysis completion
        setTimeout(() => {
          setProgress(prev => ({
            ...prev,
            stage: 'complete',
            currentUrl: 'Analysis complete! Results ready.'
          }));
        }, 3000);
        
        setResults(prev => [{
          region: selectedRegion,
          urls: urlList,
          summary: data.analysis,
          status: 'success',
          urlsAnalyzed: data.urls_analyzed || urlList.length, // Use backend's count
          followedLinks: data.followed_links || false,
          timestamp: new Date().toISOString()
        }, ...prev]);
      }
    } catch (error) {
      console.error('Error:', error);
      
      if (error.name === 'AbortError' || error.message === 'Analysis cancelled by user') {
        setProgress(prev => ({
          ...prev,
          stage: 'cancelled',
          currentUrl: 'Analysis cancelled by user'
        }));
        
        message.info('Analysis cancelled successfully');
      } else {
        setProgress(prev => ({
          ...prev,
          stage: 'error',
          currentUrl: 'Error occurred during analysis'
        }));
        
        setResults(prev => [{
          region: selectedRegion,
          urls: urlList,
          summary: 'Error occurred during analysis',
          status: 'error',
          timestamp: new Date().toISOString()
        }, ...prev]);
      }
    } finally {
      setIsLoading(false);
      setCancelRequest(null);
    }
  };

  const stopAnalysis = () => {
    if (cancelRequest) {
      cancelRequest.abort();
      setCancelRequest(null);
      setIsLoading(false);
      setProgress(prev => ({
        ...prev,
        stage: 'cancelled',
        currentUrl: 'Analysis cancelled by user'
      }));
      message.info('Cancelling analysis...');
    }
  };

  // Progress visualization components
  const getProgressPercentage = () => {
    if (progress.stage === 'idle') return 0;
    if (progress.stage === 'complete') return 100;
    if (progress.stage === 'error' || progress.stage === 'cancelled') return progress.current / progress.total * 100;
    
    const baseProgress = (progress.current / progress.total) * 80; // 80% for crawling
    if (progress.stage === 'analyzing') {
      return 80 + (20 * 0.5); // 90% during analysis
    }
    return baseProgress;
  };

  const getProgressColor = () => {
    switch (progress.stage) {
      case 'crawling': return '#1890ff';
      case 'analyzing': return '#52c41a';
      case 'complete': return '#52c41a';
      case 'error': return '#ff4d4f';
      case 'cancelled': return '#faad14';
      default: return '#d9d9d9';
    }
  };

  const getProgressStatus = () => {
    switch (progress.stage) {
      case 'crawling': return 'active';
      case 'analyzing': return 'active';
      case 'complete': return 'success';
      case 'error': return 'exception';
      case 'cancelled': return 'exception';
      default: return 'normal';
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return time.toLocaleDateString();
  };

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'crawling': return <LoadingOutlined />;
      case 'analyzing': return <LoadingOutlined />;
      case 'complete': return <CheckCircleOutlined />;
      case 'error': return <ExclamationCircleOutlined />;
      case 'cancelled': return <ExclamationCircleOutlined />;
      default: return <ClockCircleOutlined />;
    }
  };

  const resetProgress = () => {
    setProgress({
      current: 0,
      total: 0,
      stage: 'idle',
      currentUrl: '',
      crawledUrls: [],
      errors: [],
      startTime: null,
      estimatedTime: null
    });
  };

  // Source management functions
  const addSource = (name, urls) => {
    const newSource = {
      id: Date.now(),
      name,
      urls: urls.split('\n').filter(url => url.trim()),
      createdAt: new Date().toISOString()
    };
    setSavedSources(prev => [...prev, newSource]);
  };

  const removeSource = (id) => {
    setSavedSources(prev => prev.filter(source => source.id !== id));
  };

  const loadSource = (source) => {
    setUrls(source.urls.join('\n'));
    message.success(`Loaded source: ${source.name}`);
  };

  const saveCurrentAsSource = () => {
    const urlList = urls.split('\n').filter(url => url.trim());
    if (urlList.length > 0) {
      addSource(`Source ${savedSources.length + 1}`, urlList);
    }
  };

  const clearAllResults = () => {
    setResults([]);
    message.success('All results cleared');
  };

  const exportResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drought-analysis-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('Results exported successfully');
  };

  const deleteResult = (index) => {
    const newResults = results.filter((_, i) => i !== index);
    setResults(newResults);
    message.success('Result deleted');
  };

  const formatAnalysisOutput = (summary) => {
    if (!summary) return '';
    
    // Split by the specific section headers requested (handle both markdown and plain text)
    const sections = summary.split(/(?=#### \d+\. |### |Current Drought Conditions:|Food Security and Production:|Water Resources:|Food Prices:)/);
    
    return sections.map((section, index) => {
      if (section.trim() === '') return null;
      
      // Handle markdown headers (#### 1. Current Drought Conditions)
      const markdownMatch = section.match(/^#### \d+\. (.+?)$/m);
      if (markdownMatch) {
        const headerText = markdownMatch[1];
        const content = section.substring(section.indexOf('\n') + 1).trim();
        
        return (
          <div key={index} style={{ marginBottom: 24 }}>
            <Title level={4} style={{ marginBottom: 12, color: '#1890ff' }}>
              {headerText}
            </Title>
            <Paragraph style={{ marginBottom: 0, paddingLeft: 16 }}>
              {content}
            </Paragraph>
          </div>
        );
      }
      
      // Handle plain text headers
      if (section.startsWith('Current Drought Conditions:') || 
          section.startsWith('Food Security and Production:') || 
          section.startsWith('Water Resources:') || 
          section.startsWith('Food Prices:')) {
        const headerText = section.split(':')[0] + ':';
        const content = section.substring(headerText.length).trim();
        
        return (
          <div key={index} style={{ marginBottom: 24 }}>
            <Title level={4} style={{ marginBottom: 12, color: '#1890ff' }}>
              {headerText}
            </Title>
            <Paragraph style={{ marginBottom: 0, paddingLeft: 16 }}>
              {content}
            </Paragraph>
          </div>
        );
      }
      
      // Handle other markdown headers (### Drought Bulletin for...)
      const otherMarkdownMatch = section.match(/^### (.+?)$/m);
      if (otherMarkdownMatch) {
        const headerText = otherMarkdownMatch[1];
        const content = section.substring(section.indexOf('\n') + 1).trim();
        
        return (
          <div key={index} style={{ marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 12, color: '#1890ff' }}>
              {headerText}
            </Title>
            <Paragraph style={{ marginBottom: 0, paddingLeft: 16 }}>
              {content}
            </Paragraph>
          </div>
        );
      }
      
      // Regular text (fallback for any other content)
      return (
        <Paragraph key={index} style={{ marginBottom: 12 }}>
          {section}
        </Paragraph>
      );
    }).filter(Boolean);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <BarChartOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'analysis',
      icon: <SearchOutlined />,
      label: 'Analysis',
    },
    {
      key: 'sources',
      icon: <DatabaseOutlined />,
      label: 'Sources',
    },
    {
      key: 'results',
      icon: <FileTextOutlined />,
      label: 'Results',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="dark"
        style={{
          background: 'linear-gradient(180deg, #001529 0%, #003a70 100%)',
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <GlobalOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          {!collapsed && (
            <Title level={4} style={{ color: 'white', margin: '0 0 0 12px' }}>
              Experimental AI Drought Bulletins
            </Title>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['analysis']}
          selectedKeys={[currentView]}
          items={menuItems}
          onClick={({ key }) => setCurrentView(key)}
          style={{ 
            background: 'transparent',
            borderRight: 'none'
          }}
        />
      </Sider>
      
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuOutlined /> : <MenuOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
          <Tag color="blue">API: {apiKeyStatus === 'set' ? 'Connected' : 'Not Set'}</Tag>
        </Header>
        
        <Content style={{ margin: '16px', overflow: 'auto' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            
            {/* Dashboard Stats */}
            {currentView === 'analysis' && (
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={12}>
                  <Card>
                    <Statistic
                      title="Total Analyses"
                      value={results.length}
                      prefix={<FileTextOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={12}>
                  <Card>
                    <Statistic
                      title="Regions Available"
                      value={regions.length}
                      prefix={<GlobalOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={12}>
                  <Card>
                    <Statistic
                      title="URLs Crawled"
                      value={results.reduce((sum, r) => sum + (r.urlsAnalyzed || 0), 0)}
                      prefix={<LinkOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={12}>
                  <Card>
                    <Statistic
                      title="Success Rate"
                      value={results.length > 0 ? 
                        Math.round((results.filter(r => r.status === 'success').length / results.length) * 100) : 0}
                      suffix="%"
                      prefix={<BarChartOutlined />}
                    />
                  </Card>
                </Col>
                {results.length > 0 && (
                  <Col span={24}>
                    <Card size="small">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text>
                          Recent Results: {results.slice(-3).map(r => r.region).join(', ')}
                          {results.length > 3 && ` and ${results.length - 3} more`}
                        </Text>
                        <Button 
                          type="link" 
                          size="small"
                          onClick={() => setCurrentView('results')}
                        >
                          View All Results →
                        </Button>
                      </div>
                    </Card>
                  </Col>
                )}
              </Row>
            )}

            {/* Dashboard View */}
            {currentView === 'dashboard' && (
              <div>
                <Card 
                  title={
                    <Space>
                      <BarChartOutlined />
                      <span>Dashboard Overview</span>
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="Total Analyses"
                          value={results.length}
                          prefix={<FileTextOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="Regions Available"
                          value={regions.length}
                          prefix={<GlobalOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="URLs Crawled"
                          value={results.reduce((sum, r) => sum + (r.urlsAnalyzed || 0), 0)}
                          prefix={<LinkOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="Saved Sources"
                          value={savedSources.length}
                          prefix={<DatabaseOutlined />}
                        />
                      </Card>
                    </Col>
                  </Row>
                  
                  <Divider />
                  
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Card title="Recent Activity">
                        {results.length === 0 ? (
                          <Alert
                            message="No analyses yet"
                            description="Start your first analysis to see activity here."
                            type="info"
                            showIcon
                          />
                        ) : (
                          <Timeline
                            items={results.slice(-5).reverse().map((result, index) => ({
                              key: index,
                              color: result.status === 'success' ? 'green' : 'red',
                              children: (
                                <div>
                                  <Text strong>{result.region}</Text>
                                  <br />
                                  <Text type="secondary">
                                    {result.status === 'success' ? 'Analysis completed' : 'Analysis failed'}
                                  </Text>
                                </div>
                              )
                            }))}
                          />
                        )}
                      </Card>
                    </Col>
                    <Col xs={24} md={12}>
                      <Card title="Quick Actions">
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Button 
                            type="primary" 
                            block
                            onClick={() => setCurrentView('analysis')}
                          >
                            Start New Analysis
                          </Button>
                          <Button 
                            block
                            onClick={() => setCurrentView('sources')}
                          >
                            Manage Sources
                          </Button>
                          <Button 
                            block
                            onClick={() => setCurrentView('results')}
                          >
                            View Results
                          </Button>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Card>
              </div>
            )}

            {/* API Key Section */}
            {apiKeyStatus !== "set" && currentView === 'analysis' && (
              <Card 
                title={
                  <Space>
                    <KeyOutlined />
                    <span>OpenAI API Configuration</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
                extra={
                  <Alert 
                    message="API Key Required" 
                    description="Please set your OpenAI API key to begin analysis"
                    type="warning" 
                    showIcon
                  />
                }
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input.Password
                    placeholder="Enter your OpenAI API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button 
                    type="primary" 
                    onClick={handleApiKeySubmit}
                    loading={apiKeyLoading}
                  >
                    Set API Key
                  </Button>
                </Space.Compact>
              </Card>
            )}

            {/* Main Analysis Form */}
            {currentView === 'analysis' && (
              <Card 
                title={
                  <Space>
                    <SearchOutlined />
                    <span>Drought Analysis</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <div>
                      <Text strong>Region Selection</Text>
                      <Select
                        placeholder="Select a region"
                        value={selectedRegion}
                        onChange={setSelectedRegion}
                        style={{ width: '100%', marginTop: 8 }}
                        showSearch
                        filterOption={(input, option) =>
                          option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
                        }
                      >
                        {regions.map((region) => (
                          <Option key={region} value={region}>
                            {region}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  
                  <Col xs={24} md={12}>
                    <div>
                      <Text strong>Crawl Settings</Text>
                      <div style={{ marginTop: 8 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div>
                            <Switch 
                              checked={followLinks} 
                              onChange={setFollowLinks}
                              checkedChildren="Follow Links"
                              unCheckedChildren="Single Page"
                            />
                          </div>
                          {followLinks && (
                            <div>
                              <Text type="secondary">Max Depth: </Text>
                              <Select
                                value={maxDepth}
                                onChange={setMaxDepth}
                                style={{ width: 100 }}
                              >
                                <Option value={1}>1</Option>
                                <Option value={2}>2</Option>
                                <Option value={3}>3</Option>
                              </Select>
                            </div>
                          )}
                        </Space>
                      </div>
                    </div>
                  </Col>
                  
                  <Col xs={24}>
                    <div>
                      <Text strong>URLs to Analyze</Text>
                      <TextArea
                        rows={4}
                        placeholder="Enter URLs (one per line)&#10;Examples:&#10;https://www.cropmonitor.org/global-crop-monitor&#10;https://www.fao.org/3/ca9509en/ca9509en.pdf"
                        value={urls}
                        onChange={(e) => setUrls(e.target.value)}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  </Col>
                  
                  <Col xs={24}>
                    <div>
                      <Text strong>Custom Analysis Prompt (Optional)</Text>
                      <TextArea
                        rows={3}
                        placeholder="Specify any particular aspects you want the AI to focus on in the analysis. Leave empty for default drought analysis."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  </Col>
                  
                  <Col xs={24}>
                    <Space style={{ width: '100%' }}>
                      <Button 
                        type="primary" 
                        size="large"
                        onClick={handleSubmit}
                        loading={isLoading}
                        icon={<SearchOutlined />}
                        disabled={!urls.trim() || !selectedRegion || apiKeyStatus !== "set"}
                        style={{ flex: 1 }}
                      >
                        {isLoading ? 'Analyzing...' : 'Start Analysis'}
                      </Button>
                      {isLoading && (
                        <Button 
                          danger
                          size="large"
                          onClick={stopAnalysis}
                          icon={<StopOutlined />}
                        >
                          Stop Analysis
                        </Button>
                      )}
                      <Button 
                        size="large"
                        onClick={saveCurrentAsSource}
                        disabled={!urls.trim()}
                        icon={<DatabaseOutlined />}
                      >
                        Save as Source
                      </Button>
                    </Space>
                  </Col>
                  
                  {/* Progress Visualization */}
                  {(isLoading || progress.stage === 'complete' || progress.stage === 'cancelled') && (
                    <Col xs={24}>
                      <Card 
                        title={
                          <Space>
                            {getStageIcon(progress.stage)}
                            <span>Analysis Progress</span>
                            <Tag color={
                              progress.stage === 'complete' ? 'green' : 
                              progress.stage === 'error' ? 'red' : 
                              progress.stage === 'cancelled' ? 'orange' : 'blue'
                            }>
                              {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
                            </Tag>
                          </Space>
                        }
                        style={{ marginTop: 16 }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {/* Main Progress Bar */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <Text strong>Overall Progress</Text>
                              <Text type="secondary">
                                {Math.round(getProgressPercentage())}% 
                                {progress.estimatedTime && progress.stage !== 'complete' && progress.stage !== 'error' && progress.stage !== 'cancelled' && (
                                  <span> • Est. {formatTime(progress.estimatedTime)} remaining</span>
                                )}
                              </Text>
                            </div>
                            <Progress
                              percent={getProgressPercentage()}
                              status={getProgressStatus()}
                              strokeColor={getProgressColor()}
                              showInfo={false}
                              size="large"
                            />
                          </div>
                          
                          {/* Progress Steps */}
                          <div>
                            <Text strong style={{ marginBottom: 8, display: 'block' }}>Current Stage</Text>
                            <Steps 
                              current={progress.stage === 'idle' ? -1 : 
                                     progress.stage === 'crawling' ? 0 : 
                                     progress.stage === 'analyzing' ? 1 : 
                                     progress.stage === 'complete' ? 2 : 0}
                              status={progress.stage === 'error' || progress.stage === 'cancelled' ? 'error' : 'process'}
                              size="small"
                            >
                              <Step 
                                title="Crawling URLs" 
                                description={
                                  progress.stage === 'crawling' ? 
                                  `${progress.current}/${progress.total} URLs processed` : 
                                  progress.current > 0 ? `${progress.total} URLs completed` : ''
                                }
                                icon={progress.stage === 'crawling' ? <LoadingOutlined /> : undefined}
                              />
                              <Step 
                                title="Analyzing Content" 
                                description={
                                  progress.stage === 'analyzing' ? 'Generating comprehensive analysis...' :
                                  progress.stage === 'complete' ? 'Analysis completed' : ''
                                }
                                icon={progress.stage === 'analyzing' ? <LoadingOutlined /> : undefined}
                              />
                              <Step 
                                title="Complete" 
                                description={
                                  progress.stage === 'complete' ? 'Results ready' : ''
                                }
                              />
                            </Steps>
                          </div>
                          
                          {/* Current Status */}
                          {progress.currentUrl && (
                            <div>
                              <Text strong style={{ marginBottom: 8, display: 'block' }}>Current Activity</Text>
                              <Alert
                                message={progress.currentUrl}
                                type={
                                  progress.stage === 'error' ? 'error' : 
                                  progress.stage === 'cancelled' ? 'warning' : 'info'
                                }
                                showIcon
                                icon={getStageIcon(progress.stage)}
                              />
                            </div>
                          )}
                          
                          {/* Statistics */}
                          <Row gutter={[16, 8]}>
                            <Col xs={12} sm={6}>
                              <Statistic
                                title="URLs Processed"
                                value={progress.current}
                                suffix={`/ ${progress.total}`}
                                valueStyle={{ fontSize: '16px' }}
                              />
                            </Col>
                            <Col xs={12} sm={6}>
                              <Statistic
                                title="Success Rate"
                                value={progress.errors.length > 0 ? 
                                  Math.round(((progress.current - progress.errors.length) / progress.current) * 100) : 100}
                                suffix="%"
                                valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                              />
                            </Col>
                            <Col xs={12} sm={6}>
                              <Statistic
                                title="Errors"
                                value={progress.errors.length}
                                valueStyle={{ fontSize: '16px', color: progress.errors.length > 0 ? '#ff4d4f' : '#52c41a' }}
                              />
                            </Col>
                            <Col xs={12} sm={6}>
                              <Statistic
                                title="Elapsed Time"
                                value={progress.startTime ? formatTime(Date.now() - progress.startTime) : '0s'}
                                valueStyle={{ fontSize: '16px' }}
                              />
                            </Col>
                          </Row>
                          
                          {/* Error Log */}
                          {progress.errors.length > 0 && (
                            <div>
                              <Text strong style={{ marginBottom: 8, display: 'block' }}>Errors Encountered</Text>
                              <Timeline 
                                size="small"
                                items={progress.errors.map((error, index) => ({
                                  key: index,
                                  color: 'red',
                                  dot: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
                                  children: <Text type="danger">{error}</Text>
                                }))}
                              />
                            </div>
                          )}
                        </Space>
                      </Card>
                    </Col>
                  )}
                </Row>
              </Card>
            )}

            {/* Sources Section */}
            {currentView === 'sources' && (
              <Card 
                title={
                  <Space>
                    <DatabaseOutlined />
                    <span>URL Sources Management</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {/* Save Current URLs as Source */}
                  <div>
                    <Text strong>Save Current URLs as Source</Text>
                    <div style={{ marginTop: 8 }}>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="Enter source name"
                          defaultValue={`Source ${savedSources.length + 1}`}
                          id="sourceName"
                        />
                        <Button 
                          type="primary" 
                          onClick={() => {
                            const name = document.getElementById('sourceName').value || `Source ${savedSources.length + 1}`;
                            addSource(name, urls);
                          }}
                          disabled={!urls.trim()}
                        >
                          Save Current URLs
                        </Button>
                      </Space.Compact>
                    </div>
                  </div>

                  <Divider />

                  {/* Saved Sources List */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Text strong>Saved Sources ({savedSources.length})</Text>
                      {savedSources.length > 0 && (
                        <Button 
                          size="small" 
                          danger 
                          onClick={() => setSavedSources([])}
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                    
                    {savedSources.length === 0 ? (
                      <Alert
                        message="No saved sources"
                        description="Save your frequently used URL sets as sources for quick access."
                        type="info"
                        showIcon
                      />
                    ) : (
                      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {savedSources.map((source) => (
                          <Card 
                            key={source.id}
                            size="small"
                            style={{ marginBottom: 8 }}
                            actions={[
                              <Button 
                                type="link" 
                                size="small"
                                onClick={() => loadSource(source)}
                              >
                                Load
                              </Button>,
                              <Button 
                                type="link" 
                                size="small" 
                                danger
                                onClick={() => removeSource(source.id)}
                              >
                                Delete
                              </Button>
                            ]}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text strong>{source.name}</Text>
                                <Tag color="blue">{source.urls.length} URLs</Tag>
                              </div>
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: 8 }}>
                                Created: {new Date(source.createdAt).toLocaleDateString()}
                              </div>
                              <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                                {source.urls.map((url, index) => (
                                  <div key={index} style={{ fontSize: '12px', color: '#666', marginBottom: 2 }}>
                                    {url.length > 60 ? url.substring(0, 60) + '...' : url}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  <Divider />

                  {/* Quick Actions */}
                  <div>
                    <Text strong>Quick Actions</Text>
                    <div style={{ marginTop: 8 }}>
                      <Space wrap>
                        <Button 
                          size="small"
                          onClick={() => {
                            const defaultUrls = `https://www.cropmonitor.org/global-crop-monitor
https://www.fao.org/3/ca9509en/ca9509en.pdf
https://www.ncei.noaa.gov/access/monitoring/monthly-report/global-drought/202503`;
                            setUrls(defaultUrls);
                            message.success('Loaded default URLs');
                          }}
                        >
                          Load Default URLs
                        </Button>
                        <Button 
                          size="small"
                          onClick={() => {
                            setUrls('');
                            message.success('Cleared URLs');
                          }}
                        >
                          Clear URLs
                        </Button>
                      </Space>
                    </div>
                  </div>
                </Space>
              </Card>
            )}

            {/* Results Section */}
            {currentView === 'analysis' && (
              <AnimatePresence>
                {results.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card 
                      title={
                        <Space>
                          <FileTextOutlined />
                          <span>Analysis Results - {result.region}</span>
                          <Tag color={result.status === 'success' ? 'green' : 'red'}>
                            {result.status === 'success' ? 'Success' : 'Error'}
                          </Tag>
                        </Space>
                      }
                      extra={
                        <Space>
                          <Tag icon={<LinkOutlined />}>
                            {result.urlsAnalyzed || result.urls.length} URLs
                          </Tag>
                          {result.followedLinks && (
                            <Tag icon={<LinkOutlined />} color="blue">
                              Links Followed
                            </Tag>
                          )}
                          <Tooltip title={new Date(result.timestamp || Date.now()).toLocaleString()}>
                            <Tag icon={<ClockCircleOutlined />} color="default">
                              {formatRelativeTime(result.timestamp)}
                            </Tag>
                          </Tooltip>
                        </Space>
                      }
                      style={{ marginBottom: 16 }}
                    >
                      {result.status === 'success' ? (
                        <div>
                          {formatAnalysisOutput(result.summary)}
                        </div>
                      ) : (
                        <Alert
                          message="Analysis Failed"
                          description={result.summary}
                          type="error"
                          showIcon
                        />
                      )}
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {/* Dedicated Results View */}
            {currentView === 'results' && (
              <div>
                <Card 
                  title={
                    <Space>
                      <FileTextOutlined />
                      <span>Analysis Results History</span>
                      <Tag color="blue">{results.length} results</Tag>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button 
                        size="small"
                        onClick={() => setCurrentView('analysis')}
                      >
                        ← Back to Analysis
                      </Button>
                      <Button 
                        size="small"
                        onClick={exportResults}
                        disabled={results.length === 0}
                      >
                        Export All
                      </Button>
                      <Button 
                        size="small" 
                        danger
                        onClick={clearAllResults}
                        disabled={results.length === 0}
                      >
                        Clear All
                      </Button>
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                >
                  {results.length === 0 ? (
                    <Alert
                      message="No analysis results"
                      description="Run an analysis to see results here. Results are automatically saved and will persist across sessions."
                      type="info"
                      showIcon
                    />
                  ) : (
                    <div>
                      {/* Results Summary Stats */}
                      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} sm={8}>
                          <Statistic
                            title="Total Analyses"
                            value={results.length}
                            prefix={<FileTextOutlined />}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Statistic
                            title="Successful"
                            value={results.filter(r => r.status === 'success').length}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Statistic
                            title="Failed"
                            value={results.filter(r => r.status !== 'success').length}
                            prefix={<ExclamationCircleOutlined />}
                            valueStyle={{ color: '#ff4d4f' }}
                          />
                        </Col>
                      </Row>

                      {/* Results List */}
                      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                        {results.map((result, index) => (
                          <Card 
                            key={index}
                            size="small"
                            style={{ marginBottom: 12 }}
                            title={
                              <Space>
                                <FileTextOutlined />
                                <span>{result.region}</span>
                                <Tag color={result.status === 'success' ? 'green' : 'red'}>
                                  {result.status === 'success' ? 'Success' : 'Error'}
                                </Tag>
                                <Tooltip title={new Date(result.timestamp || Date.now()).toLocaleString()}>
                                  <Tag icon={<ClockCircleOutlined />} color="default">
                                    {formatRelativeTime(result.timestamp)}
                                  </Tag>
                                </Tooltip>
                              </Space>
                            }
                            extra={
                              <Space>
                                <Tag icon={<LinkOutlined />}>
                                  {result.urlsAnalyzed || result.urls?.length || 0} URLs
                                </Tag>
                                <Button 
                                  type="link" 
                                  size="small" 
                                  danger
                                  onClick={() => deleteResult(index)}
                                >
                                  Delete
                                </Button>
                              </Space>
                            }
                          >
                            {result.status === 'success' ? (
                              <div>
                                <div style={{ marginBottom: 12 }}>
                                  <Text type="secondary">
                                    Analyzed {result.urlsAnalyzed || result.urls?.length || 0} URLs
                                    {result.followedLinks && ' with link following'}
                                  </Text>
                                </div>
                                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                  {formatAnalysisOutput(result.summary)}
                                </div>
                              </div>
                            ) : (
                              <Alert
                                message="Analysis Failed"
                                description={result.summary || 'Unknown error occurred'}
                                type="error"
                                showIcon
                              />
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
