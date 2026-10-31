---
title: 词法分析器初探
date: 2019-12-26
---

本着学习的精神，开始看了一眼计概的作业！！

发现居然是词法分析，于是来了一个非自动机版本if else ~~就是懒~~

**直接贴代码了** 注释写的比较详细了

```c++
#include <iostream>
#include <fstream>
#include <cstring>
#include <string>
#include <vector>

using namespace std;

//* 目的是测试，就只设置这10个关键词
string reserveKey[10] = {"main", "void", "cout", "if", "int", "break","while","continue","long","return"};
vector<string> key, seprator, token;

//* 由于题目只要求判断三类符号，所以对于数字就忽略了 XD
bool is_Key(string &str);  //* 是否是关键词
bool is_Separator(char &ch);  //*是否是分隔符

int main(void)
{
    //* 文件读取部分
    ifstream in;
    string inName;
    cout << "请输入待分析文件名（例：code.txt):" << endl;
    while(1)
    {
        cin >> inName;
        in.open(inName);
        if(!in.is_open())
        {
            cout << "文件打开失败，请检查文件名是否正确!"<< endl;
            cout << "请再次输入待分析文件名:" << endl;
        }
        else break;
    }

    //*分析判断部分
    char ch;
    string word;
    while(!in.eof())
    {
        ch = in.get(); //*读取一个字符
        if(isdigit(ch) && word.empty()) continue;
        if(ch == ' ' || ch == '\0' || ch == '\t' || ch == '\n' || is_Separator(ch))  //* 虽然空格、回车等也属于c++中的分隔符，但是这里就暂且忽略
        {
            if(!word.empty())
            {
                if(is_Key(word)) key.push_back(word);
                else token.push_back(word);
                word.clear();
            }
            continue;
        }
        word.push_back(ch);    
    }

    //*显示分析结果
    cout << endl << "===============关键词===============" << endl;
    for(auto c : key) cout << c << "  ";
    cout << endl << endl << "===============分隔符===============" << endl;
    for(auto c : seprator) cout << c << "  ";
    cout << endl << endl << "===============标识符===============" << endl;
    for(auto c : token) cout << c << "  ";

    return 0; 
}

bool is_Key(string &str)
{
    for(auto c : reserveKey)
    {
        if(str == c) return true;
    }
    return false;
}

bool is_Separator(char &ch)
{
    if(ch == '{' || ch == '}' || ch == '(' || ch == ')' || ch == ';' || ch == '+' || ch == '-' || ch == '*' || ch == '/' || ch == '=' || ch =='>' || ch == '<')
    {
        string tmp;
        tmp.push_back(ch);
        seprator.push_back(tmp);
        return true;
    }
    return false;
}
```



emm虽然还有挺多bug，但是为了交作业就~~当看不见吧~~

下次有时间会补上的！！！