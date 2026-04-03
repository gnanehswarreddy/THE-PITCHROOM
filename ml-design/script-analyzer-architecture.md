# Fast Script Analysis ML Architecture (Under 30 Seconds)

## Overview
A high-performance script analysis system that processes text files and delivers comprehensive analysis in under 30 seconds using optimized ML pipelines and pre-trained models.

## System Architecture

### 1. Input Processing Layer (2-3 seconds)
```python
# File Reader & Preprocessor
class ScriptProcessor:
    def __init__(self):
        self.supported_formats = ['.txt', '.pdf', '.docx', '.fdx']
        
    async def extract_text(self, file_path):
        # Fast text extraction based on file type
        if file_path.endswith('.txt'):
            return await self._read_txt(file_path)
        elif file_path.endswith('.pdf'):
            return await self._read_pdf(file_path)
        elif file_path.endswith('.docx'):
            return await self._read_docx(file_path)
    
    def preprocess_text(self, text):
        # Optimized preprocessing pipeline
        return {
            'raw_text': text,
            'scenes': self._extract_scenes(text),
            'dialogue': self._extract_dialogue(text),
            'characters': self._extract_characters(text),
            'structure': self._analyze_structure(text)
        }
```

### 2. Multi-Model Analysis Pipeline (20-25 seconds)

#### A. Genre Classification (3-5 seconds)
```python
# FastText + BERT Ensemble for speed + accuracy
class GenreClassifier:
    def __init__(self):
        self.fasttext_model = load_fasttext('genre_classifier.ft')  # Fast loading
        self.bert_model = load_distilbert('script-genre-classifier')  # Lightweight BERT
        
    async def classify_genre(self, text_features):
        # Parallel processing
        fasttext_pred = self.fasttext_model.predict(text_features['tfidf'])
        bert_pred = self.bert_model.predict(text_features['tokens'])
        
        # Weighted ensemble (70% BERT accuracy, 30% FastText speed)
        return self._ensemble_predictions([fasttext_pred, bert_pred])
```

#### B. Structure Analysis (4-6 seconds)
```python
# Rule-based + ML hybrid for script structure
class StructureAnalyzer:
    def __init__(self):
        self.scene_classifier = load_model('scene_classifier.pkl')
        self.pacing_analyzer = PacingAnalyzer()
        
    def analyze_structure(self, script_data):
        # Parallel analysis
        tasks = [
            self._identify_acts(script_data),
            self._analyze_pacing(script_data),
            self._detect_plot_points(script_data)
        ]
        return await asyncio.gather(*tasks)
```

#### C. Character Analysis (5-7 seconds)
```python
# Named Entity Recognition + Character Arc Analysis
class CharacterAnalyzer:
    def __init__(self):
        self.ner_model = load_spacy_model('en_core_web_sm')  # Fast NER
        self.character_arc_model = load_model('character_arc_classifier')
        
    async def analyze_characters(self, script_data):
        characters = self._extract_characters_with_ner(script_data)
        
        # Parallel character analysis
        character_tasks = [
            self._analyze_character_arc(char, script_data) 
            for char in characters[:10]  # Limit to main characters
        ]
        
        return await asyncio.gather(*character_tasks)
```

#### D. Dialogue Analysis (4-6 seconds)
```python
# Sentiment + Voice Analysis
class DialogueAnalyzer:
    def __init__(self):
        self.sentiment_model = load_transformer('distilbert-base-uncased-finetuned-sst-2-english')
        self.voice_classifier = load_model('dialogue_voice_classifier')
        
    async def analyze_dialogue(self, dialogue_text):
        # Batch processing for efficiency
        sentiments = await self._batch_sentiment_analysis(dialogue_text)
        voice_patterns = await self._analyze_voice_patterns(dialogue_text)
        
        return {
            'sentiment_distribution': sentiments,
            'voice_consistency': voice_patterns,
            'dialogue_density': self._calculate_dialogue_density(dialogue_text)
        }
```

#### E. Marketability Analysis (3-4 seconds)
```python
# Pre-trained market analysis model
class MarketabilityAnalyzer:
    def __init__(self):
        self.market_model = load_model('script_marketability_predictor')
        self.comparable_analyzer = ComparablesAnalyzer()
        
    async def analyze_marketability(self, script_features):
        # Fast market prediction
        market_score = self.market_model.predict(script_features)
        comparable_titles = self.comparable_analyzer.find_similar_scripts(script_features)
        
        return {
            'market_score': market_score,
            'comparable_titles': comparable_titles,
            'target_audience': self._predict_audience(script_features)
        }
```

### 3. Result Aggregation Layer (2-3 seconds)
```python
class ResultAggregator:
    def __init__(self):
        self.report_template = ScriptAnalysisTemplate()
        
    async def generate_report(self, analysis_results):
        # Combine all analysis results
        comprehensive_report = {
            'genre': analysis_results['genre'],
            'structure': analysis_results['structure'],
            'characters': analysis_results['characters'],
            'dialogue': analysis_results['dialogue'],
            'marketability': analysis_results['marketability'],
            'overall_score': self._calculate_overall_score(analysis_results),
            'recommendations': self._generate_recommendations(analysis_results)
        }
        
        return self.report_template.format(comprehensive_report)
```

## Performance Optimizations

### 1. Model Optimization
- **DistilBERT** instead of full BERT (40% faster, 97% accuracy)
- **FastText** for initial classification (sub-second inference)
- **Quantized models** to reduce memory usage
- **Batch processing** for dialogue analysis

### 2. Caching Strategy
```python
class AnalysisCache:
    def __init__(self):
        self.redis_client = redis.Redis()
        
    async def get_cached_analysis(self, script_hash):
        cached = self.redis_client.get(f"analysis:{script_hash}")
        return json.loads(cached) if cached else None
        
    async def cache_analysis(self, script_hash, results):
        self.redis_client.setex(f"analysis:{script_hash}", 3600, json.dumps(results))
```

### 3. Parallel Processing
```python
async def analyze_script(script_content):
    # Create analysis pipeline
    processor = ScriptProcessor()
    
    # Extract features
    features = await processor.preprocess_text(script_content)
    
    # Run all analyses in parallel
    tasks = [
        GenreClassifier().classify_genre(features),
        StructureAnalyzer().analyze_structure(features),
        CharacterAnalyzer().analyze_characters(features),
        DialogueAnalyzer().analyze_dialogue(features['dialogue']),
        MarketabilityAnalyzer().analyze_marketability(features)
    ]
    
    results = await asyncio.gather(*tasks)
    
    # Aggregate results
    return await ResultAggregator().generate_report(dict(zip(
        ['genre', 'structure', 'characters', 'dialogue', 'marketability'], 
        results
    )))
```

## Implementation Timeline

### Phase 1: Core Models (2 weeks)
- Train genre classification model on 10,000+ scripts
- Develop structure analysis rules and ML models
- Create character extraction and analysis pipeline

### Phase 2: Optimization (1 week)
- Implement parallel processing
- Add caching layer
- Optimize model inference speed

### Phase 3: Integration (1 week)
- Integrate with existing backend
- Add file upload and text extraction
- Implement result formatting

## Expected Performance
- **Text Extraction**: 2-3 seconds
- **Genre Classification**: 3-5 seconds (95% accuracy)
- **Structure Analysis**: 4-6 seconds (90% accuracy)
- **Character Analysis**: 5-7 seconds (85% accuracy)
- **Dialogue Analysis**: 4-6 seconds (88% accuracy)
- **Marketability Analysis**: 3-4 seconds (80% accuracy)
- **Total Time**: 21-31 seconds (target: under 30 seconds)

## Technology Stack
- **Backend**: Python 3.9+ with FastAPI
- **ML Framework**: PyTorch + Transformers + scikit-learn
- **Text Processing**: spaCy + NLTK
- **Caching**: Redis
- **Deployment**: Docker + GPU acceleration

## API Design
```python
@app.post("/analyze-script")
async def analyze_script(file: UploadFile):
    # Extract text
    script_content = await extract_text_from_file(file)
    
    # Analyze
    analysis_results = await analyze_script(script_content)
    
    return {
        "status": "completed",
        "analysis": analysis_results,
        "processing_time": analysis_results['metadata']['processing_time']
    }
```

This architecture ensures accurate script analysis while maintaining the under-30-second requirement through optimized models, parallel processing, and intelligent caching.
