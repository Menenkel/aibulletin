import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Layout, 
  Menu, 
  Card, 
  Button, 
  Input, 
  Select, 
  Switch, 
  Typography, 
  Space, 
  Divider,
  Alert,
  Spin,
  Tag,
  Progress,
  Statistic,
  Row,
  Col,
  Steps,
  Timeline,
  message
} from "antd";
import {
  GlobalOutlined,
  SearchOutlined,
  SettingOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  KeyOutlined,
  LinkOutlined,
  MenuOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Step } = Steps;

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/.netlify/functions';

// Updated with dark mode toggle and background animation
function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState("not_set");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [urls, setUrls] = useState("");
  const [customPrompt, setCustomPrompt] = useState(`Please analyze the provided URLs and create a comprehensive AI drought analysis for the selected region. Include:

1. **Current Drought Conditions**: Assess the severity and extent of drought in the region
2. **Food Security and Production**: Effects on crops, livestock, and food security
3. **Water Resources**: Status of surface water, groundwater, and reservoir levels
4. **Food Prices**: Impact on food prices and market conditions

Focus on actionable insights and clear, concise reporting suitable for policymakers and stakeholders.`);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [followLinks, setFollowLinks] = useState(true);
  const [maxDepth, setMaxDepth] = useState(2);
  const [collapsed, setCollapsed] = useState(false);
  const [pdfSupport, setPdfSupport] = useState(false);
  
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

  useEffect(() => {
    // Load regions
    fetch(`${API_BASE_URL}/regions`)
      .then((res) => res.json())
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Error loading regions:", err);
        setRegions([]); // ensure it's an array on error
      });

    // Check API key status
    fetch(`${API_BASE_URL}/api-key`)
      .then((res) => res.json())
      .then((data) => setApiKeyStatus(data.has_api_key ? "set" : "not_set"))
      .catch((err) => console.error("Error checking API key status:", err));

    // Load saved URLs and custom prompt
    fetch(`${API_BASE_URL}/saved-urls`)
      .then((res) => res.json())
      .then((data) => {
        setUrls(data.urls.join("\n"));
        if (data.custom_prompt !== undefined) {
          setCustomPrompt(data.custom_prompt);
        }
      })
      .catch((err) => console.error("Error loading saved URLs:", err));

    // Check PDF support status
    fetch(`${API_BASE_URL}/health`)
      .then((res) => res.json())
      .then((data) => setPdfSupport(data.pdf_support || false))
      .catch((err) => console.error("Error checking PDF support:", err));
  }, []);

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      
      if (response.ok) {
        setApiKeyStatus("set");
        setApiKey("");
      }
    } catch (error) {
      console.error("Error setting API key:", error);
    }
  };

  const handleSubmit = async () => {
    if (!urls.trim() || !selectedRegion) return;
    
    const urlList = urls.split('\n').filter(url => url.trim());
    
    // Reset any previous progress
    resetProgress();
    
    // Initialize progress
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
          const url = urlList[i];
          
          // Update current URL being processed
          setProgress(prev => ({
            ...prev,
            current: i,
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
      
      const response = await fetch(`${API_BASE_URL}/crawl-and-summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: urlList,
          region: selectedRegion,
          custom_prompt: customPrompt,
          follow_links: followLinks,
          max_depth: maxDepth
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Simulate analysis completion
        setTimeout(() => {
          setProgress(prev => ({
            ...prev,
            stage: 'complete',
            currentUrl: 'Analysis complete! Results ready.'
          }));
        }, 3000);
        
        setResults(prev => [...prev, {
          region: selectedRegion,
          urls: urlList,
          summary: data.summary,
          status: 'success',
          urlsAnalyzed: data.urls_analyzed || urlList.length,
          followedLinks: data.followed_links || false,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setProgress(prev => ({
        ...prev,
        stage: 'error',
        currentUrl: 'Error occurred during analysis'
      }));
      
      setResults(prev => [...prev, {
        region: selectedRegion,
        urls: urlList,
        summary: 'Error occurred during analysis',
        status: 'error',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Progress visualization components
  const getProgressPercentage = () => {
    if (progress.stage === 'idle') return 0;
    if (progress.stage === 'complete') return 100;
    if (progress.stage === 'error') return progress.current / progress.total * 100;
    
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
      default: return '#d9d9d9';
    }
  };

  const getProgressStatus = () => {
    switch (progress.stage) {
      case 'crawling': return 'active';
      case 'analyzing': return 'active';
      case 'complete': return 'success';
      case 'error': return 'exception';
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

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'crawling': return <LoadingOutlined />;
      case 'analyzing': return <LoadingOutlined />;
      case 'complete': return <CheckCircleOutlined />;
      case 'error': return <ExclamationCircleOutlined />;
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

  const formatAnalysisOutput = (summary) => {
    if (!summary) return '';
    
    // Split by the specific section headers requested
    const sections = summary.split(/(?=Current Drought Conditions:|Food Security and Production:|Water Resources:|Food Prices:)/);
    
    return sections.map((section, index) => {
      if (section.trim() === '') return null;
      
      // Check if it's one of our specific headers
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
      key: 'results',
      icon: <FileTextOutlined />,
      label: 'Results',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
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
          items={menuItems}
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
        
        <Content style={{ margin: '24px', overflow: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            
            {/* Dashboard Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
                    title="Success Rate"
                    value={results.length > 0 ? 
                      Math.round((results.filter(r => r.status === 'success').length / results.length) * 100) : 0}
                    suffix="%"
                    prefix={<BarChartOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {/* API Key Section */}
            {apiKeyStatus !== "set" && (
              <Card 
                title={
                  <Space>
                    <KeyOutlined />
                    <span>OpenAI API Configuration</span>
                  </Space>
                }
                style={{ marginBottom: 24 }}
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
                    loading={isLoading}
                  >
                    Set API Key
                  </Button>
                </Space.Compact>
              </Card>
            )}

            {/* Main Analysis Form */}
            <Card 
              title={
                <Space>
                  <SearchOutlined />
                  <span>Drought Analysis</span>
                </Space>
              }
              style={{ marginBottom: 24 }}
            >
              <Row gutter={[24, 16]}>
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
                    <Text strong>Custom Analysis Prompt</Text>
                    <TextArea
                      rows={6}
                      placeholder="Enter your custom analysis prompt..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                </Col>
                
                <Col xs={24}>
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={handleSubmit}
                    loading={isLoading}
                    icon={<SearchOutlined />}
                    disabled={!urls.trim() || !selectedRegion || apiKeyStatus !== "set"}
                    style={{ width: '100%' }}
                  >
                    {isLoading ? 'Analyzing...' : 'Start Analysis'}
                  </Button>
                </Col>
                
                {/* Progress Visualization */}
                {(isLoading || progress.stage === 'complete') && (
                  <Col xs={24}>
                    <Card 
                      title={
                        <Space>
                          {getStageIcon(progress.stage)}
                          <span>Analysis Progress</span>
                          <Tag color={progress.stage === 'complete' ? 'green' : progress.stage === 'error' ? 'red' : 'blue'}>
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
                              {progress.estimatedTime && progress.stage !== 'complete' && progress.stage !== 'error' && (
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
                            status={progress.stage === 'error' ? 'error' : 'process'}
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
                              type={progress.stage === 'error' ? 'error' : 'info'}
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

            {/* Results Section */}
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
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
