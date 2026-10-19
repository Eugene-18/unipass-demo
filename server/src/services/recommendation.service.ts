import { db } from '../db';
import { tags, departmentProfiles, studentFeatureCache, activityTags ,events} from '../db/schema';
import { eq } from 'drizzle-orm';


// 定義回傳的推薦結果介面
export interface RecommendationResult {
  deptName: string;
  college: string;
  matchRate: number; // 匹配率 (百分比)
}

// 輔助函式：計算餘弦相似度 (Cosine Similarity)
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 核心推薦服務 (科系推薦)
export async function getDepartmentRecommendations(studentId: number, topK: number = 5): Promise<RecommendationResult[]> {
  const allTags = await db.select().from(tags);
  const tagIndexMap = new Map<number, number>();
  allTags.forEach((t, index) => tagIndexMap.set(t.id, index));
  const dimensionSize = allTags.length;

  const studentFeatures = await db.select().from(studentFeatureCache).where(eq(studentFeatureCache.studentId, studentId));
  
  const studentVector = new Array(dimensionSize).fill(0);
  studentFeatures.forEach(feature => {
    const index = tagIndexMap.get(feature.tagId);
    if (index !== undefined) {
      studentVector[index] = Number(feature.score);
    }
  });

  const hasFeatures = studentVector.some(score => score > 0);
  if (!hasFeatures) return [];

  const profiles = await db.select().from(departmentProfiles);
  const groupedDepts = new Map<string, { college: string, vector: number[] }>();
  
  profiles.forEach(p => {
      if(!groupedDepts.has(p.deptName)) {
          groupedDepts.set(p.deptName, { college: p.college, vector: new Array(dimensionSize).fill(0) });
      }
      const deptData = groupedDepts.get(p.deptName)!;
      const index = tagIndexMap.get(p.tagId);
      if (index !== undefined) {
          deptData.vector[index] = Number(p.requiredWeight);
      }
  });

  const results: RecommendationResult[] = [];
  
  groupedDepts.forEach((data, deptName) => {
    const similarity = calculateCosineSimilarity(studentVector, data.vector);
    results.push({
      deptName,
      college: data.college,
      matchRate: Number((similarity * 100).toFixed(2)) 
    });
  });

  results.sort((a, b) => b.matchRate - a.matchRate);
  return results.slice(0, topK);
}

// 創新 B 方案延伸：活動推薦引擎
export async function getActivityRecommendations(studentId: number, topK: number = 5) {
  // 1. 取得所有標籤，建立向量維度對應
  const allTags = await db.select().from(tags);
  const tagIndexMap = new Map<number, number>();
  allTags.forEach((t, index) => tagIndexMap.set(t.id, index));
  const dimensionSize = allTags.length;

  // 2. 建立學生的特質向量並計算長度 (分母)
  const studentFeatures = await db.select().from(studentFeatureCache).where(eq(studentFeatureCache.studentId, studentId));
  const studentVector = new Array(dimensionSize).fill(0);
  let studentVectorLength = 0;
  
  studentFeatures.forEach(feature => {
    const index = tagIndexMap.get(feature.tagId);
    if (index !== undefined) {
      const score = Number(feature.score);
      studentVector[index] = score;
      studentVectorLength += score * score;
    }
  });
  studentVectorLength = Math.sqrt(studentVectorLength);

  // 3. 取得所有活動的標籤權重並建立活動向量 (修正為 activityId)
  const allActivityTags = await db.select().from(activityTags);
  const activityMap = new Map<number, number[]>();
  
  allActivityTags.forEach(at => {
    if (!activityMap.has(at.activityId)) { 
      activityMap.set(at.activityId, new Array(dimensionSize).fill(0));
    }
    const index = tagIndexMap.get(at.tagId);
    if (index !== undefined) {
      activityMap.get(at.activityId)![index] = Number(at.weight); 
    }
  });

  // 4. 計算每個活動與學生的餘弦相似度 (Cosine Similarity)
  // 4. 計算每個活動與學生的餘弦相似度 (Cosine Similarity)
  const recommendations: { activityId: number; matchRate: number }[] = [];
  for (const [activityId, activityVector] of activityMap.entries()) {
    let dotProduct = 0;
    let activityVectorLength = 0;
    
    for (let i = 0; i < dimensionSize; i++) {
      dotProduct += studentVector[i] * activityVector[i];
      activityVectorLength += activityVector[i] * activityVector[i];
    }
    activityVectorLength = Math.sqrt(activityVectorLength);

    let matchRate = 0;
    if (studentVectorLength > 0 && activityVectorLength > 0) {
      matchRate = (dotProduct / (studentVectorLength * activityVectorLength)) * 100;
    }

// 5. 暫時存入陣列 (此時還沒有名稱)
    recommendations.push({
      activityId,
      matchRate: Number(matchRate.toFixed(1))
    });
  }

  // 6. 去 events 表格把真實活動名稱撈出來
  const allEvents = await db.select().from(events);
  const eventNameMap = new Map<number, string>();
  allEvents.forEach(e => eventNameMap.set(e.id, e.title));

  // 7. 依匹配率降冪排序並回傳前 Top K 筆，同時把 title 塞進去
  const topRecommendations = recommendations.sort((a, b) => b.matchRate - a.matchRate).slice(0, topK);

  return topRecommendations.map(r => ({
    activityId: r.activityId,
    title: eventNameMap.get(r.activityId) || '未知活動', // 如果找不到就顯示未知
    matchRate: r.matchRate
  }));
}