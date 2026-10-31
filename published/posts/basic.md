---
title: 基础算法
date: 2020-04-12
---

1. **快速排序** 
    
    时间复杂度 O(nlogn) ~ O(n^2)
    
    分治的思想 → 划分 求解 合并
    
    快排不稳定，如果想稳定可以用pair 加上下标 双关键字排序 （保证元素不重复）
    
    具体步骤：
    
    1. 确定分界点 q[l] q[(l+r)/2] q[r]

    2. 调整区间        >  x  < 
    3. 递归处理左右两端
    
    ```cpp
    void quick_sort(int q[], int l , int r)
    {
    	if(l >= r) return;
    	int i = l - 1, j = r + 1, x = q[l + r >> 1];
    	while(i < j)
    	{
    		do ++i; while(q[i] < x);
    		do --j; while(q[j] > x);
    		if(i < j) swap(q[i], q[j]);
    	}
    	quick_sort(q, l, j);
    	quick_sort(q, j + 1, r);
    }
    ```
    
2. **归并排序**
    
    时间复杂度 O(nlogn)  
    
    分治的思想
    
    具体步骤：
    
    1. 确定分界点 mid = (l + r) / 2
    2. 递归排序
    3. 归并 — 合二为一
    
    ```cpp
    int t[N]
    void merge_sort(int q[], int l, int r)
    {
    	if(l >= r) return;
    	int mid = l + r >> 1;
    	
    	merge_sort(q, l, mid);
    	merge_sort(q, mid + 1, r);
    
    	int i = l , j = mid + 1, k = 0;
    	while(i <= mid && j <= r)
    	{
    		if(q[i] < q[j]) t[k++] = q[i++];
    		else t[k++] = q[j++];
    	}
    	while(i <= mid) t[k++] = q[i++];
    	while(j <= r) t[k++] = q[j++];
    	
    	for(int i = l, k = 0; i <= r; i ++, k ++)
    		q[i] = t[k];
    }
    ```
    
3. **二分**
    
    二分的本质不是单调性， 而是边界，左半边满足某种性质，而右半边不满足
    
    单调一定可以二分，但是能二分不一定单调
    
    步骤 ：
    
    1. 选一个mid  mid = （l+r）/ 2
    2. check一个性质
    3. 确定要找的结果所在的区间
    
    ```cpp
    // 二分模板
    // 整数模板
    int bsearch_1(int l, int r)
    {
    	while(l < r)
    	{
    		int mid = l + r >> 1;  //mid 向下取整
    		if(check(mid)) r = mid;  //检查mid是否满足某种性质
    		else l = mid + 1;
    	}
    	return l;
    }
    
    int bsearch_2(int l, int r)
    {
    	while(l < r)
    	{
    		int mid = l + r + 1 >> 1; // mid 向上取整
    		if(check(mid)) l = mid;   //检查mid是否满足某种性质
    		else r = mid - 1;
    	}
    	return l;
    }
    
    bool check(double x) {/* ... */} // 检查x是否满足某种性质
    
    // 浮点数二分模板
    double bsearch_3(double l, double r)
    {
        const double eps = 1e-6;   // eps 表示精度，取决于题目对精度的要求
        while (r - l > eps)
        {
            double mid = (l + r) / 2;
            if (check(mid)) r = mid;
            else l = mid;
        }
        return l;
    }
    ```
    
4. **高精度**
    
    步骤
    
    1. 大整数存储   低位在左 
    2. 模拟人工算的过程
    
    ```cpp
    // 高精度加法 A + B
    vector<int> add(vector<int> &A, vector<int> &B)
    {
        vector<int> C;
        int t = 0;
        for(int i = 0; i < A.size() || i < B.size(); i ++)
        {
            if(i < A.size()) t += A[i];
            if(i < B.size()) t += B[i];
            C.push_back(t % 10);
            t /= 10;
        }
        
        if(t) C.push_back(t);
        
        return C;
    }
    
    // 高精度减法 A - B   
    // 假定 A >= B
    
    // assume A >= B
    // C = A - B
    vector<int> sub(vector<int> &A, vector<int> &B)
    {
        vector<int> C;
        int t = 0;
        for(int i = 0; i < A.size(); i ++)
        {
            t = A[i] - t;
            if(i < B.size()) t -= B[i];
            C.push_back((t + 10) % 10);
            t = (t < 0 ? 1 : 0);
        }
        
    		// 去除前导0
        while(C.size() > 1 && C.back() == 0) C.pop_back();
        
        return C;
    }
    
    // 高精度乘法
    // A * a  大数 ✖ 小数
    vector<int> mul(vector<int> &A, int b)
    {
        vector<int> C;
        int t = 0;
        for(int i = 0; i < A.size() || t; i ++)
        {
            if(i < A.size()) t += A[i] * b;
            C.push_back(t % 10); 
            t /= 10;
        }
        
    		// 去除前导0
        while(C.size() > 1 && C.back() == 0) C.pop_back();
        return C;
    }
    
    //高精度除法 求商 和 余数
    // A / b  大数 / 小数 
    vector<int> div(vector<int> &A, int b, int &r)
    {
        vector<int> C;
        r = 0;
        for(int i = A.size() - 1; i >= 0; i --)
        {
            r = ((r * 10) + A[i]);
            C.push_back(r / b);
            r = r % b;
        }
        
        reverse(C.begin(), C.end());
        while(C.size() > 1 && C.back() == 0) C.pop_back();
        return C;
    }
    
    ```
    
5. **前缀和与差分**
    
    前缀和：
    
    一维前缀和：
    
    S[i] = a[1] + a[2] + ... a[i]
    a[l] + ... + a[r] = S[r] - S[l - 1]
    
    二维前缀和：
    
    S[i, j] = 第i行j列格子左上部分所有元素的和
    以(x1, y1)为左上角，(x2, y2)为右下角的子矩阵的和为：
    S[x2, y2] - S[x1 - 1, y2] - S[x2, y1 - 1] + S[x1 - 1, y1 - 1]
    
    差分：
    
    一维差分：
    
    给区间[l, r]中的每个数加上c：B[l] += c, B[r + 1] -= c
    
    二维差分：
    
    给以(x1, y1)为左上角，(x2, y2)为右下角的子矩阵中的所有元素加上c：
    S[x1, y1] += c, S[x2 + 1, y1] -= c, S[x1, y2 + 1] -= c, S[x2 + 1, y2 + 1] += c
    
    前缀和与差分互为逆运算
    
6. **双指针算法**
    
    ```cpp
    for (int i = 0, j = 0; i < n; i ++ )
    {
        while (j < i && check(i, j)) j ++ ;
    
        // 具体问题的逻辑
    }
    常见问题分类：
        (1) 对于一个序列，用两个指针维护一段区间
        (2) 对于两个序列，维护某种次序，比如归并排序中合并两个有序序列的操作
    ```
    
7. **位运算**
    
    n的二进制表示中，第K位是几:  n >> k & 1
    
    步骤：
    
    1. 先把第K位移到最后一位 n >> k 
    2. 看个位是几  与上1  x & 1
    
    返回n的最后一位1：
    
    lowbit(n) = n & -n
    
    eg:  x = 1010   lowbit(x) = 10
    
     x = 11100  lowbit(x) = 100
    
8. **离散化**
    
    主要问题：
    
    1. 去重：可能有重复元素 （set， unique）
    2. 如何快速找出映射的值（map， 二分查找→有序映射）
    
    ```cpp
    vector<int> alls; // 存储所有待离散化的值
    sort(alls.begin(), alls.end()); // 将所有值排序
    alls.erase(unique(alls.begin(), alls.end()), alls.end());   // 去掉重复元素
    
    // 二分求出x对应的离散化的值
    int find(int x) // 找到第一个大于等于x的位置
    {
        int l = 0, r = alls.size() - 1;
        while (l < r)
        {
            int mid = l + r >> 1;
            if (alls[mid] >= x) r = mid;
            else l = mid + 1;
        }
        return r + 1; // 映射到1, 2, ...n
    }
    ```
    
9. **区间合并**
    
    左端点排序，比较右端点，判断交集
    
    ```cpp
    // 将所有存在交集的区间合并
    void merge(vector<PII> &segs)
    {
        vector<PII> res;
    
        sort(segs.begin(), segs.end());
    
        int st = -2e9, ed = -2e9;
        for (auto seg : segs)
            if (ed < seg.first)
            {
                if (st != -2e9) res.push_back({st, ed});
                st = seg.first, ed = seg.second;
            }
            else ed = max(ed, seg.second);
    
        if (st != -2e9) res.push_back({st, ed});
    
        segs = res;
    }
    ```