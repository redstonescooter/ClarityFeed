import json
import os
import re
import requests
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Any, Tuple
import numpy as np

class TweetAnalyzer:
    def __init__(self, data_directory: str, groq_api_key: str = None):
        self.data_directory = Path(data_directory)
        self.data = []
        self.df = None
        self.insights = {}
        self.groq_api_key = groq_api_key or os.getenv('GROQ_API_KEY')
        self.groq_base_url = 'https://api.groq.com/openai/v1'
        
        # Create timestamped output directory
        current_time = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        self.output_dir = Path(f'visualizations/{current_time}')
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def categorize_topics_with_groq(self, topics: List[str]) -> Dict[str, str]:
        """Use Groq API to categorize topics into general categories"""
        if not self.groq_api_key:
            print("Warning: No Groq API key found. Using fallback categorization.")
            return self._fallback_categorization(topics)
        
        try:
            # Prepare the prompt for topic categorization
            topics_text = "\n".join([f"- {topic}" for topic in topics])
            
            prompt = f"""
            Categorize the following tweet topics into general categories. Return a JSON object where each topic is mapped to one of these categories:
            - Technology
            - Personal
            - Business
            - Entertainment
            - Social Commentary
            - Health & Wellness
            - Education
            - Politics
            - Sports
            - Lifestyle
            - Other
            
            Topics to categorize:
            {topics_text}
            
            Return only a JSON object in this format:
            {{
                "topic1": "category",
                "topic2": "category",
                ...
            }}
            """
            
            response = requests.post(
                f"{self.groq_base_url}/chat/completions",
                headers={
                    'Authorization': f'Bearer {self.groq_api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'messages': [
                        {
                            'role': 'user',
                            'content': prompt
                        }
                    ],
                    "model": "llama-3.3-70b-versatile",  # Using a stable model
                    "temperature": 0.3,  # Lower temperature for more consistent categorization
                    "max_tokens": 2048,
                    "response_format": {
                        "type": "json_object"
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                try:
                    categorization = json.loads(content)
                    print(f"✅ Successfully categorized {len(categorization)} topics using Groq API")
                    return categorization
                except json.JSONDecodeError:
                    print("Warning: Invalid JSON response from Groq. Using fallback categorization.")
                    return self._fallback_categorization(topics)
            else:
                print(f"Warning: Groq API error {response.status_code}. Using fallback categorization.")
                return self._fallback_categorization(topics)
                
        except Exception as e:
            print(f"Warning: Error calling Groq API: {e}. Using fallback categorization.")
            return self._fallback_categorization(topics)
    
    def _fallback_categorization(self, topics: List[str]) -> Dict[str, str]:
        """Fallback topic categorization using keyword matching"""
        categorization = {}
        
        category_keywords = {
            'Technology': ['software', 'tech', 'developer', 'coding', 'programming', 'security', 'AI', 'digital'],
            'Personal': ['family', 'personal', 'autism', 'career', 'gratitude', 'milestone', 'encouragement'],
            'Business': ['freelance', 'pricing', 'economic', 'service', 'commercial', 'satellite'],
            'Entertainment': ['satire', 'hype', 'nostalgia', 'humor'],
            'Social Commentary': ['industry', 'comparison', 'complaint', 'commentary'],
            'Health & Wellness': ['wellness', 'health', 'mental'],
            'Lifestyle': ['lifestyle', 'daily', 'routine'],
            'Technology': ['iPhone', 'earbud', 'battery', 'internet']
        }
        
        for topic in topics:
            topic_lower = topic.lower()
            categorized = False
            
            for category, keywords in category_keywords.items():
                if any(keyword.lower() in topic_lower for keyword in keywords):
                    categorization[topic] = category
                    categorized = True
                    break
            
            if not categorized:
                categorization[topic] = 'Other'
        
        return categorization
        
    def load_data(self):
        """Load all JSON files from the directory and extract timestamps from filenames"""
        all_data = []
        
        for file_path in self.data_directory.glob("*.json"):
            # Extract timestamp from filename (assuming formats like YYYY-MM-DD.json or timestamp_YYYY-MM-DD.json)
            timestamp = self._extract_timestamp(file_path.name)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    tweets = json.load(f)
                    
                # Add timestamp to each tweet
                for tweet in tweets:
                    if not tweet.get('skip', False):  # Only include non-skipped tweets
                        tweet['timestamp'] = timestamp
                        tweet['date'] = timestamp.date()
                        all_data.append(tweet)
                        
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                
        self.data = all_data
        self.df = pd.DataFrame(all_data)
        if not self.df.empty:
            self.df['date'] = pd.to_datetime(self.df['date'])
            
            # Categorize topics using Groq API
            unique_topics = self.df['topic'].unique().tolist()
            topic_categories = self.categorize_topics_with_groq(unique_topics)
            
            # Add category column to dataframe
            self.df['topic_category'] = self.df['topic'].map(topic_categories)
            
        print(f"Loaded {len(all_data)} tweets from {len(list(self.data_directory.glob('*.json')))} files")
        print(f"Results will be saved to: {self.output_dir}")
        
    def _extract_timestamp(self, filename: str) -> datetime:
        """Extract timestamp from filename with various format support"""
        # Remove .json extension
        name = filename.replace('.json', '')
        
        # Try different timestamp formats
        patterns = [
            r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
            r'(\d{4}_\d{2}_\d{2})',  # YYYY_MM_DD
            r'(\d{8})',              # YYYYMMDD
            r'(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})', # YYYY-MM-DD_HH-MM-SS
        ]
        
        for pattern in patterns:
            match = re.search(pattern, name)
            if match:
                date_str = match.group(1)
                try:
                    if '_' in date_str and len(date_str) > 10:
                        # Format: YYYY-MM-DD_HH-MM-SS
                        return datetime.strptime(date_str, '%Y-%m-%d_%H-%M-%S')
                    elif '-' in date_str:
                        # Format: YYYY-MM-DD
                        return datetime.strptime(date_str, '%Y-%m-%d')
                    elif '_' in date_str:
                        # Format: YYYY_MM_DD
                        return datetime.strptime(date_str, '%Y_%m_%d')
                    elif len(date_str) == 8:
                        # Format: YYYYMMDD
                        return datetime.strptime(date_str, '%Y%m%d')
                except ValueError:
                    continue
                    
        # Fallback to file modification time
        file_path = self.data_directory / filename
        return datetime.fromtimestamp(file_path.stat().st_mtime)
        
    def generate_content_categorization(self) -> Dict:
        """Analyze content categories and topics"""
        if self.df.empty:
            return {}
            
        # Topic clustering (original topics)
        topic_counts = self.df['topic'].value_counts()
        
        # Category distribution (new general categories)
        category_counts = self.df['topic_category'].value_counts()
        
        # Emotional patterns by topic category
        emotion_by_category = {}
        try:
            for category in self.df['topic_category'].unique():
                if pd.notna(category):  # Skip NaN values
                    category_emotions = self.df[self.df['topic_category'] == category]['emotion'].value_counts()
                    emotion_by_category[str(category)] = category_emotions.to_dict()
        except Exception as e:
            print(f"Warning: Error processing emotion_by_category: {e}")
            emotion_by_category = {}
        
        # Emotional patterns by original topic
        emotion_by_topic = {}
        try:
            for topic in self.df['topic'].unique():
                if pd.notna(topic):  # Skip NaN values
                    topic_emotions = self.df[self.df['topic'] == topic]['emotion'].value_counts()
                    emotion_by_topic[str(topic)] = topic_emotions.to_dict()
        except Exception as e:
            print(f"Warning: Error processing emotion_by_topic: {e}")
            emotion_by_topic = {}
        
        return {
            'topic_distribution': topic_counts.to_dict(),
            'category_distribution': category_counts.to_dict(),
            'emotion_by_topic': emotion_by_topic,
            'emotion_by_category': emotion_by_category
        }
        
    def generate_key_metrics(self) -> Dict:
        """Calculate key metrics and patterns"""
        if self.df.empty:
            return {}
            
        # Emotional sentiment distribution
        emotion_dist = self.df['emotion'].value_counts(normalize=True).to_dict()
        
        # Topic frequency
        topic_freq = self.df['topic'].value_counts().to_dict()
        
        # Category frequency
        category_freq = self.df['topic_category'].value_counts().to_dict()
        
        # Humor usage patterns
        humor_rate = self.df['humor'].mean()
        humor_by_topic = self.df.groupby('topic')['humor'].mean().to_dict()
        humor_by_category = self.df.groupby('topic_category')['humor'].mean().to_dict()
        
        # Political content analysis
        political_tweets = self.df[self.df['political_alignment'].apply(
            lambda x: x != ['none'] if isinstance(x, list) else x != 'none'
        )]
        political_ratio = len(political_tweets) / len(self.df) if not self.df.empty else 0
        
        return {
            'emotion_distribution': emotion_dist,
            'topic_frequency': topic_freq,
            'category_frequency': category_freq,
            'humor_rate': humor_rate,
            'humor_by_topic': humor_by_topic,
            'humor_by_category': humor_by_category,
            'political_content_ratio': political_ratio
        }
        
    def generate_trend_analysis(self) -> Dict:
        """Analyze trends over time"""
        if self.df.empty or 'date' not in self.df.columns:
            return {}
            
        # Daily tweet counts
        daily_counts = self.df.groupby(self.df['date'].dt.date).size()
        
        # Emotional trends over time
        emotion_trends = self.df.groupby([self.df['date'].dt.date, 'emotion']).size().unstack(fill_value=0)
        
        # Topic evolution (original topics)
        topic_trends = self.df.groupby([self.df['date'].dt.date, 'topic']).size().unstack(fill_value=0)
        
        # Category evolution (general categories)
        category_trends = self.df.groupby([self.df['date'].dt.date, 'topic_category']).size().unstack(fill_value=0)
        
        # Weekly patterns (if enough data)
        if len(daily_counts) >= 7:
            try:
                weekly_pattern = {}
                for day_of_week in range(7):  # 0=Monday, 6=Sunday
                    day_data = self.df[self.df['date'].dt.dayofweek == day_of_week]
                    if not day_data.empty:
                        day_emotions = day_data['emotion'].value_counts(normalize=True)
                        weekly_pattern[str(day_of_week)] = day_emotions.to_dict()
            except Exception as e:
                print(f"Warning: Error processing weekly patterns: {e}")
                weekly_pattern = {}
        else:
            weekly_pattern = {}
            
        return {
            'daily_tweet_counts': daily_counts.to_dict(),
            'emotion_trends': emotion_trends.to_dict() if not emotion_trends.empty else {},
            'topic_trends': topic_trends.to_dict() if not topic_trends.empty else {},
            'category_trends': category_trends.to_dict() if not category_trends.empty else {},
            'weekly_emotional_patterns': weekly_pattern
        }
        
    def generate_engagement_insights(self) -> Dict:
        """Analyze content that might drive engagement"""
        if self.df.empty:
            return {}
            
        # Humor correlation with topics and categories
        humor_topics = self.df[self.df['humor'] == True]['topic'].value_counts().to_dict()
        humor_categories = self.df[self.df['humor'] == True]['topic_category'].value_counts().to_dict()
        
        # Emotional intensity by topic
        emotion_intensity = {}
        for topic in self.df['topic'].unique():
            topic_data = self.df[self.df['topic'] == topic]
            intense_emotions = topic_data[topic_data['emotion'].isin(['anger', 'joy', 'sadness'])].shape[0]
            total_topic_tweets = topic_data.shape[0]
            emotion_intensity[topic] = intense_emotions / total_topic_tweets if total_topic_tweets > 0 else 0
        
        # Emotional intensity by category
        category_intensity = {}
        for category in self.df['topic_category'].unique():
            category_data = self.df[self.df['topic_category'] == category]
            intense_emotions = category_data[category_data['emotion'].isin(['anger', 'joy', 'sadness'])].shape[0]
            total_category_tweets = category_data.shape[0]
            category_intensity[category] = intense_emotions / total_category_tweets if total_category_tweets > 0 else 0
            
        # Content diversity score (how varied are topics)
        topic_diversity = len(self.df['topic'].unique()) / len(self.df) if not self.df.empty else 0
        category_diversity = len(self.df['topic_category'].unique()) / len(self.df) if not self.df.empty else 0
        
        return {
            'humor_by_topics': humor_topics,
            'humor_by_categories': humor_categories,
            'emotional_intensity_by_topic': emotion_intensity,
            'emotional_intensity_by_category': category_intensity,
            'topic_diversity_score': topic_diversity,
            'category_diversity_score': category_diversity
        }
        
    def generate_actionable_insights(self) -> Dict:
        """Generate actionable recommendations"""
        metrics = self.generate_key_metrics()
        engagement = self.generate_engagement_insights()
        trends = self.generate_trend_analysis()
        
        insights = []
        
        # Content strategy recommendations
        if metrics.get('humor_rate', 0) < 0.2:
            insights.append("Consider adding more humor - current rate is low")
            
        # Emotional balance analysis
        emotion_dist = metrics.get('emotion_distribution', {})
        if emotion_dist.get('neutral', 0) > 0.7:
            insights.append("Content is heavily neutral - consider more emotional engagement")
            
        # Topic diversification
        if engagement.get('topic_diversity_score', 0) < 0.1:
            insights.append("Consider diversifying topics for broader appeal")
            
        # Best performing content types (categories)
        humor_categories = engagement.get('humor_by_categories', {})
        if humor_categories:
            top_humor_category = max(humor_categories.keys(), key=humor_categories.get)
            insights.append(f"'{top_humor_category}' category works well with humor - consider similar content")
            
        # Category-based recommendations
        category_freq = metrics.get('category_frequency', {})
        if category_freq:
            top_category = max(category_freq.keys(), key=category_freq.get)
            insights.append(f"Most content falls under '{top_category}' - consider balancing with other categories")
            
        return {
            'recommendations': insights,
            'top_emotional_topics': sorted(
                engagement.get('emotional_intensity_by_topic', {}).items(), 
                key=lambda x: x[1], reverse=True
            )[:3],
            'top_emotional_categories': sorted(
                engagement.get('emotional_intensity_by_category', {}).items(), 
                key=lambda x: x[1], reverse=True
            )[:3]
        }
        
    def create_visualizations(self):
        """Create comprehensive visualizations in the timestamped directory"""
        if self.df.empty:
            print("No data to visualize")
            return
            
        # Set style
        plt.style.use('default')
        sns.set_palette("husl")
        
        # 1. Emotion Distribution
        fig, ax = plt.subplots(figsize=(10, 6))
        emotion_counts = self.df['emotion'].value_counts()
        colors = sns.color_palette("husl", len(emotion_counts))
        bars = ax.bar(emotion_counts.index, emotion_counts.values, color=colors)
        ax.set_title('Tweet Emotion Distribution', fontsize=16, fontweight='bold')
        ax.set_xlabel('Emotion')
        ax.set_ylabel('Count')
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 0.1,
                   f'{int(height)}', ha='center', va='bottom')
        
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(self.output_dir / 'emotion_distribution.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 2. Topic Categories Distribution
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(20, 8))
        
        # Original topics
        topic_counts = self.df['topic'].value_counts().head(10)  # Top 10 topics
        colors = sns.color_palette("viridis", len(topic_counts))
        bars1 = ax1.barh(range(len(topic_counts)), topic_counts.values, color=colors)
        ax1.set_yticks(range(len(topic_counts)))
        ax1.set_yticklabels([topic[:30] + '...' if len(topic) > 30 else topic 
                           for topic in topic_counts.index])
        ax1.set_title('Top 10 Tweet Topics', fontsize=14, fontweight='bold')
        ax1.set_xlabel('Count')
        
        for i, (bar, value) in enumerate(zip(bars1, topic_counts.values)):
            ax1.text(value + 0.05, bar.get_y() + bar.get_height()/2,
                   f'{int(value)}', ha='left', va='center')
        
        # General categories
        category_counts = self.df['topic_category'].value_counts()
        colors2 = sns.color_palette("Set2", len(category_counts))
        wedges, texts, autotexts = ax2.pie(category_counts.values, labels=category_counts.index, 
                                          autopct='%1.1f%%', colors=colors2)
        ax2.set_title('Tweet Categories Distribution', fontsize=14, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(self.output_dir / 'topics_and_categories.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 3. Emotion-Category Heatmap
        if len(self.df) > 1:
            fig, ax = plt.subplots(figsize=(12, 8))
            emotion_category_matrix = self.df.groupby(['topic_category', 'emotion']).size().unstack(fill_value=0)
            sns.heatmap(emotion_category_matrix, annot=True, fmt='d', cmap='YlOrRd', ax=ax)
            ax.set_title('Emotion Distribution Across Topic Categories', fontsize=16, fontweight='bold')
            ax.set_xlabel('Emotion')
            ax.set_ylabel('Category')
            plt.xticks(rotation=45)
            plt.yticks(rotation=0)
            plt.tight_layout()
            plt.savefig(self.output_dir / 'emotion_category_heatmap.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 4. Time series if multiple days
        if 'date' in self.df.columns and len(self.df['date'].unique()) > 1:
            fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(14, 15))
            
            # Daily tweet counts
            daily_counts = self.df.groupby(self.df['date'].dt.date).size()
            ax1.plot(daily_counts.index, daily_counts.values, marker='o', linewidth=2)
            ax1.set_title('Daily Tweet Volume', fontsize=14, fontweight='bold')
            ax1.set_xlabel('Date')
            ax1.set_ylabel('Tweet Count')
            ax1.grid(True, alpha=0.3)
            
            # Emotion trends
            emotion_daily = self.df.groupby([self.df['date'].dt.date, 'emotion']).size().unstack(fill_value=0)
            for emotion in emotion_daily.columns:
                ax2.plot(emotion_daily.index, emotion_daily[emotion], 
                        marker='o', label=emotion, linewidth=2)
            ax2.set_title('Daily Emotion Trends', fontsize=14, fontweight='bold')
            ax2.set_xlabel('Date')
            ax2.set_ylabel('Count')
            ax2.legend()
            ax2.grid(True, alpha=0.3)
            
            # Category trends
            category_daily = self.df.groupby([self.df['date'].dt.date, 'topic_category']).size().unstack(fill_value=0)
            for category in category_daily.columns:
                ax3.plot(category_daily.index, category_daily[category], 
                        marker='o', label=category, linewidth=2)
            ax3.set_title('Daily Category Trends', fontsize=14, fontweight='bold')
            ax3.set_xlabel('Date')
            ax3.set_ylabel('Count')
            ax3.legend()
            ax3.grid(True, alpha=0.3)
            
            plt.tight_layout()
            plt.savefig(self.output_dir / 'time_series_analysis.png', dpi=300, bbox_inches='tight')
            plt.close()
            
        print(f"Visualizations saved to {self.output_dir}")
        
    def generate_comprehensive_report(self) -> Dict:
        """Generate a comprehensive analysis report"""
        self.insights = {
            'metadata': {
                'analysis_timestamp': datetime.now().isoformat(),
                'output_directory': str(self.output_dir)
            },
            'summary': {
                'total_tweets': len(self.df) if not self.df.empty else 0,
                'date_range': {
                    'start': self.df['date'].min().isoformat() if not self.df.empty and 'date' in self.df.columns else None,
                    'end': self.df['date'].max().isoformat() if not self.df.empty and 'date' in self.df.columns else None
                } if not self.df.empty and 'date' in self.df.columns else None,
                'unique_topics': len(self.df['topic'].unique()) if not self.df.empty else 0,
                'unique_categories': len(self.df['topic_category'].unique()) if not self.df.empty else 0
            },
            'content_categorization': self.generate_content_categorization(),
            'key_metrics': self.generate_key_metrics(),
            'trend_analysis': self.generate_trend_analysis(),
            'engagement_insights': self.generate_engagement_insights(),
            'actionable_insights': self.generate_actionable_insights()
        }
        
        return self.insights
        
    def safe_json_serialize(self, obj):
        """Safely serialize objects to JSON-compatible format"""
        if isinstance(obj, dict):
            return {str(k): self.safe_json_serialize(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self.safe_json_serialize(item) for item in obj]
        elif isinstance(obj, (np.integer, np.floating)):
            return obj.item()
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif pd.isna(obj):
            return None
        elif hasattr(obj, 'isoformat'):  # datetime objects
            return obj.isoformat()
        else:
            return obj
        
    def save_report(self, filename: str = 'tweet_analysis_report.json'):
        """Save the comprehensive report to a JSON file in the timestamped directory"""
        if not self.insights:
            self.generate_comprehensive_report()
        
        report_path = self.output_dir / filename
        
        try:
            # Clean the insights data for JSON serialization
            clean_insights = self.safe_json_serialize(self.insights)
            
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(clean_insights, f, indent=2, ensure_ascii=False, default=str)
            print(f"Report saved to {report_path}")
            
        except Exception as e:
            print(f"Error saving report: {e}")
            # Try saving with a simpler structure
            try:
                simplified_report = {
                    'metadata': self.insights.get('metadata', {}),
                    'summary': self.insights.get('summary', {}),
                    'key_metrics': {
                        'emotion_distribution': self.insights.get('key_metrics', {}).get('emotion_distribution', {}),
                        'category_frequency': self.insights.get('key_metrics', {}).get('category_frequency', {}),
                        'humor_rate': self.insights.get('key_metrics', {}).get('humor_rate', 0)
                    },
                    'error': f"Full report failed to serialize: {str(e)}"
                }
                
                with open(report_path, 'w', encoding='utf-8') as f:
                    json.dump(simplified_report, f, indent=2, ensure_ascii=False)
                print(f"Simplified report saved to {report_path}")
                
            except Exception as e2:
                print(f"Failed to save even simplified report: {e2}")
        
    def print_summary(self):
        """Print a summary of key insights"""
        if not self.insights:
            self.generate_comprehensive_report()
            
        print("\n" + "="*60)
        print("TWEET ANALYSIS SUMMARY")
        print("="*60)
        
        summary = self.insights['summary']
        print(f"📊 Total Tweets Analyzed: {summary['total_tweets']}")
        print(f"📅 Date Range: {summary.get('date_range', {}).get('start', 'N/A')} to {summary.get('date_range', {}).get('end', 'N/A')}")
        print(f"🏷️  Unique Topics: {summary['unique_topics']}")
        print(f"📂 Unique Categories: {summary['unique_categories']}")
        
        print("\n🎭 EMOTIONAL BREAKDOWN:")
        emotions = self.insights['key_metrics'].get('emotion_distribution', {})
        for emotion, pct in sorted(emotions.items(), key=lambda x: x[1], reverse=True):
            print(f"   {emotion.capitalize()}: {pct:.1%}")
            
        print("\n📊 TOP CATEGORIES:")
        categories = self.insights['key_metrics'].get('category_frequency', {})
        for category, count in list(categories.items())[:5]:
            print(f"   {category}: {count} tweets")
            
        print("\n📈 TOP TOPICS:")
        topics = self.insights['key_metrics'].get('topic_frequency', {})
        for topic, count in list(topics.items())[:5]:
            print(f"   {topic}: {count} tweets")
            
        print(f"\n😄 Humor Rate: {self.insights['key_metrics'].get('humor_rate', 0):.1%}")
        
        print("\n💡 KEY RECOMMENDATIONS:")
        recommendations = self.insights['actionable_insights'].get('recommendations', [])
        for rec in recommendations:
            print(f"   • {rec}")
            
        print(f"\n📁 Results saved to: {self.output_dir}")
        print("="*60)

# Example usage and main execution
def main():
    # Initialize analyzer with Groq API key
    groq_api_key = os.getenv('GROQ_API_KEY')  # Make sure to set this environment variable
    
    analyzer = TweetAnalyzer(
        data_directory='/root/programming/clarityFeed/analysis_results/',  # Adjust path to your JSON files directory
        groq_api_key=groq_api_key
    )
    
    # Load and analyze data
    analyzer.load_data()
    
    if analyzer.df.empty:
        print("No data loaded. Please check your data directory and file formats.")
        return
    
    # Generate comprehensive report
    report = analyzer.generate_comprehensive_report()
    
    # Print summary
    analyzer.print_summary()
    
    # Create visualizations
    analyzer.create_visualizations()
    
    # Save detailed report
    analyzer.save_report()
    
    print("\n✅ Analysis complete! Check the generated files:")
    print(f"   - {analyzer.output_dir}/tweet_analysis_report.json (detailed insights)")
    print(f"   - {analyzer.output_dir}/*.png (charts and graphs)")

if __name__ == "__main__":
    main()