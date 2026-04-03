export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      accLevelMetric: {
        Row: {
          aov: number
          bb: number
          catc: number
          cgb: number
          clientId: string
          cpa: number
          cpl: number
          cpm: number
          createdAt: string
          ctra: number
          ctrl: number
          fetchedAt: string
          id: string
          isoWeek: number
          leads: number
          platform: Database["public"]["Enums"]["Platform"]
          purchases: number
          purchasesValue: number
          roas: number
          tenantId: string
          updatedAt: string | null
        }
        Insert: {
          aov: number
          bb: number
          catc: number
          cgb: number
          clientId: string
          cpa: number
          cpl: number
          cpm: number
          createdAt?: string
          ctra: number
          ctrl: number
          fetchedAt?: string
          id: string
          isoWeek: number
          leads: number
          platform: Database["public"]["Enums"]["Platform"]
          purchases: number
          purchasesValue: number
          roas: number
          tenantId: string
          updatedAt?: string | null
        }
        Update: {
          aov?: number
          bb?: number
          catc?: number
          cgb?: number
          clientId?: string
          cpa?: number
          cpl?: number
          cpm?: number
          createdAt?: string
          ctra?: number
          ctrl?: number
          fetchedAt?: string
          id?: string
          isoWeek?: number
          leads?: number
          platform?: Database["public"]["Enums"]["Platform"]
          purchases?: number
          purchasesValue?: number
          roas?: number
          tenantId?: string
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accLevelMetric_clientId_platform_fkey"
            columns: ["clientId", "platform"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id", "platform"]
          },
          {
            foreignKeyName: "accLevelMetric_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      AccLevelSummary: {
        Row: {
          clientId: string
          createdAt: string
          id: string
          isoWeek: number
          lastAttempt: string
          platform: Database["public"]["Enums"]["Platform"]
          retryCount: number
          status: Database["public"]["Enums"]["SummaryStatus"]
          summary: string | null
          tenantId: string
        }
        Insert: {
          clientId: string
          createdAt: string
          id: string
          isoWeek: number
          lastAttempt?: string
          platform: Database["public"]["Enums"]["Platform"]
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
          tenantId: string
        }
        Update: {
          clientId?: string
          createdAt?: string
          id?: string
          isoWeek?: number
          lastAttempt?: string
          platform?: Database["public"]["Enums"]["Platform"]
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "AccLevelSummary_clientId_isoWeek_fkey"
            columns: ["clientId", "isoWeek"]
            isOneToOne: false
            referencedRelation: "accLevelMetric"
            referencedColumns: ["clientId", "isoWeek"]
          },
          {
            foreignKeyName: "AccLevelSummary_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      Ad: {
        Row: {
          adCopies: string[] | null
          adDestination: string | null
          adFormat: string | null
          adId: string
          adName: string
          adSetId: string
          advantageCreativeConfig: Json | null
          callToAction: string | null
          carouselCards: Json | null
          createdAt: string
          descriptions: string[] | null
          errorMessage: string | null
          id: string
          imageFormat: string | null
          leadFormName: string | null
          metaStatus: string | null
          notes: string | null
          squareImageUrl: string | null
          status: string | null
          storyImageUrl: string | null
          titles: string[] | null
          updatedAt: string | null
          url: string | null
          urlParameters: string | null
          videoThumbnailUrl: string | null
          videoUrl: string | null
        }
        Insert: {
          adCopies?: string[] | null
          adDestination?: string | null
          adFormat?: string | null
          adId: string
          adName: string
          adSetId: string
          advantageCreativeConfig?: Json | null
          callToAction?: string | null
          carouselCards?: Json | null
          createdAt?: string
          descriptions?: string[] | null
          errorMessage?: string | null
          id: string
          imageFormat?: string | null
          leadFormName?: string | null
          metaStatus?: string | null
          notes?: string | null
          squareImageUrl?: string | null
          status?: string | null
          storyImageUrl?: string | null
          titles?: string[] | null
          updatedAt?: string | null
          url?: string | null
          urlParameters?: string | null
          videoThumbnailUrl?: string | null
          videoUrl?: string | null
        }
        Update: {
          adCopies?: string[] | null
          adDestination?: string | null
          adFormat?: string | null
          adId?: string
          adName?: string
          adSetId?: string
          advantageCreativeConfig?: Json | null
          callToAction?: string | null
          carouselCards?: Json | null
          createdAt?: string
          descriptions?: string[] | null
          errorMessage?: string | null
          id?: string
          imageFormat?: string | null
          leadFormName?: string | null
          metaStatus?: string | null
          notes?: string | null
          squareImageUrl?: string | null
          status?: string | null
          storyImageUrl?: string | null
          titles?: string[] | null
          updatedAt?: string | null
          url?: string | null
          urlParameters?: string | null
          videoThumbnailUrl?: string | null
          videoUrl?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Ad_adSetId_fkey"
            columns: ["adSetId"]
            isOneToOne: false
            referencedRelation: "AdSet"
            referencedColumns: ["id"]
          },
        ]
      }
      AdAccounts: {
        Row: {
          category: Database["public"]["Enums"]["ClientCategory"] | null
          createdAt: string
          docFileLink: string | null
          id: string
          instagramId: string | null
          pageId: string | null
          pixelId: string | null
          platform: string
          platformAccountId: string
          platformAccountName: string
          tenantId: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["ClientCategory"] | null
          createdAt?: string
          docFileLink?: string | null
          id: string
          instagramId?: string | null
          pageId?: string | null
          pixelId?: string | null
          platform: string
          platformAccountId: string
          platformAccountName: string
          tenantId: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ClientCategory"] | null
          createdAt?: string
          docFileLink?: string | null
          id?: string
          instagramId?: string | null
          pageId?: string | null
          pixelId?: string | null
          platform?: string
          platformAccountId?: string
          platformAccountName?: string
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "AdAccounts_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      adLevelMetric: {
        Row: {
          adId: string
          atc: number
          createdAt: string
          ctrAll: number
          ctrLink: number
          fatigueFlag: boolean
          ic: number
          id: string
          impressions: number
          lpvRate: number
          purchases: number
          thumb_stop_ratio: number
          week: number
        }
        Insert: {
          adId: string
          atc: number
          createdAt?: string
          ctrAll: number
          ctrLink: number
          fatigueFlag: boolean
          ic: number
          id: string
          impressions: number
          lpvRate: number
          purchases: number
          thumb_stop_ratio: number
          week: number
        }
        Update: {
          adId?: string
          atc?: number
          createdAt?: string
          ctrAll?: number
          ctrLink?: number
          fatigueFlag?: boolean
          ic?: number
          id?: string
          impressions?: number
          lpvRate?: number
          purchases?: number
          thumb_stop_ratio?: number
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "adLevelMetric_adId_fkey"
            columns: ["adId"]
            isOneToOne: false
            referencedRelation: "Ad"
            referencedColumns: ["id"]
          },
        ]
      }
      AdSet: {
        Row: {
          adSetId: string
          adSetName: string
          attributionSetting: string | null
          bidStrategy: string | null
          budgetType: string | null
          budgetValue: number | null
          campaignId: string
          conversionEvent: string | null
          conversionLocation: string | null
          createdAt: string
          dynamicCreative: boolean | null
          endDate: string | null
          errorMessage: string | null
          id: string
          location: string | null
          locationType: string | null
          metaStatus: string | null
          optimizationGoal: string | null
          performanceGoals: string | null
          pixelId: string | null
          placementOptions: Json | null
          placements: string | null
          setEndDate: boolean | null
          startDate: string | null
          status: string | null
          targetAge: string | null
          targetGender: string | null
          updatedAt: string | null
        }
        Insert: {
          adSetId: string
          adSetName: string
          attributionSetting?: string | null
          bidStrategy?: string | null
          budgetType?: string | null
          budgetValue?: number | null
          campaignId: string
          conversionEvent?: string | null
          conversionLocation?: string | null
          createdAt?: string
          dynamicCreative?: boolean | null
          endDate?: string | null
          errorMessage?: string | null
          id: string
          location?: string | null
          locationType?: string | null
          metaStatus?: string | null
          optimizationGoal?: string | null
          performanceGoals?: string | null
          pixelId?: string | null
          placementOptions?: Json | null
          placements?: string | null
          setEndDate?: boolean | null
          startDate?: string | null
          status?: string | null
          targetAge?: string | null
          targetGender?: string | null
          updatedAt?: string | null
        }
        Update: {
          adSetId?: string
          adSetName?: string
          attributionSetting?: string | null
          bidStrategy?: string | null
          budgetType?: string | null
          budgetValue?: number | null
          campaignId?: string
          conversionEvent?: string | null
          conversionLocation?: string | null
          createdAt?: string
          dynamicCreative?: boolean | null
          endDate?: string | null
          errorMessage?: string | null
          id?: string
          location?: string | null
          locationType?: string | null
          metaStatus?: string | null
          optimizationGoal?: string | null
          performanceGoals?: string | null
          pixelId?: string | null
          placementOptions?: Json | null
          placements?: string | null
          setEndDate?: boolean | null
          startDate?: string | null
          status?: string | null
          targetAge?: string | null
          targetGender?: string | null
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AdSet_campaignId_fkey"
            columns: ["campaignId"]
            isOneToOne: false
            referencedRelation: "Campaign"
            referencedColumns: ["id"]
          },
        ]
      }
      adSetLevelMetric: {
        Row: {
          adSetId: string
          atc: number
          atcValue: number
          cpa: number
          cpatc: number
          cpc: number
          cpic: number
          createdAt: string
          ctrAll: number
          ctrLink: number
          frequency: number
          ic: number
          icValue: number
          id: string
          impressions: number
          linkClicks: number
          lpv: number
          lpvRate: number
          purchases: number
          purchaseValue: number
          reach: number
          roas: number
          week: number
        }
        Insert: {
          adSetId: string
          atc: number
          atcValue: number
          cpa: number
          cpatc: number
          cpc: number
          cpic: number
          createdAt?: string
          ctrAll: number
          ctrLink: number
          frequency: number
          ic: number
          icValue: number
          id: string
          impressions: number
          linkClicks: number
          lpv: number
          lpvRate: number
          purchases: number
          purchaseValue: number
          reach: number
          roas: number
          week: number
        }
        Update: {
          adSetId?: string
          atc?: number
          atcValue?: number
          cpa?: number
          cpatc?: number
          cpc?: number
          cpic?: number
          createdAt?: string
          ctrAll?: number
          ctrLink?: number
          frequency?: number
          ic?: number
          icValue?: number
          id?: string
          impressions?: number
          linkClicks?: number
          lpv?: number
          lpvRate?: number
          purchases?: number
          purchaseValue?: number
          reach?: number
          roas?: number
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "adSetLevelMetric_adSetId_fkey"
            columns: ["adSetId"]
            isOneToOne: false
            referencedRelation: "AdSet"
            referencedColumns: ["id"]
          },
        ]
      }
      AdSetSummary: {
        Row: {
          adSetId: string
          createdAt: string
          id: string
          lastAttempt: string
          retryCount: number
          status: Database["public"]["Enums"]["SummaryStatus"]
          summary: string | null
        }
        Insert: {
          adSetId: string
          createdAt: string
          id: string
          lastAttempt?: string
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
        }
        Update: {
          adSetId?: string
          createdAt?: string
          id?: string
          lastAttempt?: string
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AdSetSummary_adSetId_createdAt_fkey"
            columns: ["adSetId", "createdAt"]
            isOneToOne: false
            referencedRelation: "adSetLevelMetric"
            referencedColumns: ["adSetId", "createdAt"]
          },
        ]
      }
      AdsetTemplates: {
        Row: {
          adsetBudgetType: string | null
          adsetBudgetValue: number | null
          adsetConversionEvent: string | null
          adsetConversionLocation: string | null
          adsetPerformanceGoals: string | null
          attributionSetting: string | null
          bidAmount: number | null
          bidStrategy: string | null
          createdAt: string | null
          customAudiences: string | null
          dynamicCreative: boolean | null
          endDate: string | null
          excludedAudiences: string | null
          id: string
          location: string | null
          locationType: string | null
          name: string
          optimization: string | null
          pixelId: string | null
          placementOptions: Json | null
          placements: string | null
          promotedObjectType: string | null
          setEndDate: boolean | null
          startDate: string | null
          targetAge: string | null
          targetGender: string | null
          tenantId: string
        }
        Insert: {
          adsetBudgetType?: string | null
          adsetBudgetValue?: number | null
          adsetConversionEvent?: string | null
          adsetConversionLocation?: string | null
          adsetPerformanceGoals?: string | null
          attributionSetting?: string | null
          bidAmount?: number | null
          bidStrategy?: string | null
          createdAt?: string | null
          customAudiences?: string | null
          dynamicCreative?: boolean | null
          endDate?: string | null
          excludedAudiences?: string | null
          id?: string
          location?: string | null
          locationType?: string | null
          name?: string
          optimization?: string | null
          pixelId?: string | null
          placementOptions?: Json | null
          placements?: string | null
          promotedObjectType?: string | null
          setEndDate?: boolean | null
          startDate?: string | null
          targetAge?: string | null
          targetGender?: string | null
          tenantId: string
        }
        Update: {
          adsetBudgetType?: string | null
          adsetBudgetValue?: number | null
          adsetConversionEvent?: string | null
          adsetConversionLocation?: string | null
          adsetPerformanceGoals?: string | null
          attributionSetting?: string | null
          bidAmount?: number | null
          bidStrategy?: string | null
          createdAt?: string | null
          customAudiences?: string | null
          dynamicCreative?: boolean | null
          endDate?: string | null
          excludedAudiences?: string | null
          id?: string
          location?: string | null
          locationType?: string | null
          name?: string
          optimization?: string | null
          pixelId?: string | null
          placementOptions?: Json | null
          placements?: string | null
          promotedObjectType?: string | null
          setEndDate?: boolean | null
          startDate?: string | null
          targetAge?: string | null
          targetGender?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "AdsetTemplates_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      AdSummary: {
        Row: {
          adId: string
          createdAt: string
          id: string
          lastAttempt: string
          retryCount: number
          status: Database["public"]["Enums"]["SummaryStatus"]
          summary: string | null
        }
        Insert: {
          adId: string
          createdAt: string
          id: string
          lastAttempt?: string
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
        }
        Update: {
          adId?: string
          createdAt?: string
          id?: string
          lastAttempt?: string
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AdSummary_adId_createdAt_fkey"
            columns: ["adId", "createdAt"]
            isOneToOne: false
            referencedRelation: "adLevelMetric"
            referencedColumns: ["adId", "createdAt"]
          },
        ]
      }
      AdTemplates: {
        Row: {
          callToAction: string | null
          conversionDomain: string | null
          createdAt: string | null
          creativeType: string | null
          id: string
          name: string
          tenantId: string
          trackingPixelId: string | null
          urlParameters: string | null
        }
        Insert: {
          callToAction?: string | null
          conversionDomain?: string | null
          createdAt?: string | null
          creativeType?: string | null
          id?: string
          name?: string
          tenantId: string
          trackingPixelId?: string | null
          urlParameters?: string | null
        }
        Update: {
          callToAction?: string | null
          conversionDomain?: string | null
          createdAt?: string | null
          creativeType?: string | null
          id?: string
          name?: string
          tenantId?: string
          trackingPixelId?: string | null
          urlParameters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AdTemplates_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      AdvantageCreativeTemplates: {
        Row: {
          carouselEnhancements: Json | null
          catalogEnhancements: Json | null
          createdAt: string | null
          id: string
          imageEnhancements: Json | null
          name: string
          tenantId: string
          videoEnhancements: Json | null
        }
        Insert: {
          carouselEnhancements?: Json | null
          catalogEnhancements?: Json | null
          createdAt?: string | null
          id?: string
          imageEnhancements?: Json | null
          name?: string
          tenantId: string
          videoEnhancements?: Json | null
        }
        Update: {
          carouselEnhancements?: Json | null
          catalogEnhancements?: Json | null
          createdAt?: string | null
          id?: string
          imageEnhancements?: Json | null
          name?: string
          tenantId?: string
          videoEnhancements?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "AdvantageCreativeTemplates_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      AiEnhancementRules: {
        Row: {
          actions: string | null
          conditions: string | null
          createdAt: string | null
          enabled: boolean | null
          id: string
          name: string
          ruleType: string | null
          tenantId: string
        }
        Insert: {
          actions?: string | null
          conditions?: string | null
          createdAt?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          ruleType?: string | null
          tenantId: string
        }
        Update: {
          actions?: string | null
          conditions?: string | null
          createdAt?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          ruleType?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "AiEnhancementRules_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      Campaign: {
        Row: {
          adAccountId: string | null
          advantageCampaignBudget: boolean | null
          advantagePlusCatalog: boolean | null
          bidStrategy: string | null
          buyingType: string | null
          campaignBudgetType: string | null
          campaignBudgetValue: number | null
          campaignId: string
          campaignName: string
          catalogId: string | null
          clientId: string
          createdAt: string
          errorMessage: string | null
          id: string
          metaStatus: string | null
          objective: string | null
          specialAdCategories: string[] | null
          status: string | null
          tenantId: string
          updatedAt: string | null
        }
        Insert: {
          adAccountId?: string | null
          advantageCampaignBudget?: boolean | null
          advantagePlusCatalog?: boolean | null
          bidStrategy?: string | null
          buyingType?: string | null
          campaignBudgetType?: string | null
          campaignBudgetValue?: number | null
          campaignId: string
          campaignName: string
          catalogId?: string | null
          clientId: string
          createdAt?: string
          errorMessage?: string | null
          id: string
          metaStatus?: string | null
          objective?: string | null
          specialAdCategories?: string[] | null
          status?: string | null
          tenantId: string
          updatedAt?: string | null
        }
        Update: {
          adAccountId?: string | null
          advantageCampaignBudget?: boolean | null
          advantagePlusCatalog?: boolean | null
          bidStrategy?: string | null
          buyingType?: string | null
          campaignBudgetType?: string | null
          campaignBudgetValue?: number | null
          campaignId?: string
          campaignName?: string
          catalogId?: string | null
          clientId?: string
          createdAt?: string
          errorMessage?: string | null
          id?: string
          metaStatus?: string | null
          objective?: string | null
          specialAdCategories?: string[] | null
          status?: string | null
          tenantId?: string
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Campaign_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Campaign_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      campaignLevelMetric: {
        Row: {
          aov: number
          campaignId: string
          cpm: number
          createdAt: string
          id: string
          impressions: number
          learning_phase: boolean
          mer: number
          revenue: number
          roas: number
          spend: number
          tenantId: string
          week: number
        }
        Insert: {
          aov: number
          campaignId: string
          cpm: number
          createdAt?: string
          id: string
          impressions: number
          learning_phase: boolean
          mer: number
          revenue: number
          roas: number
          spend: number
          tenantId: string
          week: number
        }
        Update: {
          aov?: number
          campaignId?: string
          cpm?: number
          createdAt?: string
          id?: string
          impressions?: number
          learning_phase?: boolean
          mer?: number
          revenue?: number
          roas?: number
          spend?: number
          tenantId?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaignLevelMetric_campaignId_fkey"
            columns: ["campaignId"]
            isOneToOne: false
            referencedRelation: "Campaign"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaignLevelMetric_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      CampaignSummary: {
        Row: {
          campaignId: string
          createdAt: string
          id: string
          lastAttempt: string
          retryCount: number
          status: Database["public"]["Enums"]["SummaryStatus"]
          summary: string | null
          tenantId: string
        }
        Insert: {
          campaignId: string
          createdAt: string
          id: string
          lastAttempt?: string
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
          tenantId: string
        }
        Update: {
          campaignId?: string
          createdAt?: string
          id?: string
          lastAttempt?: string
          retryCount?: number
          status?: Database["public"]["Enums"]["SummaryStatus"]
          summary?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "CampaignSummary_campaignId_createdAt_fkey"
            columns: ["campaignId", "createdAt"]
            isOneToOne: false
            referencedRelation: "campaignLevelMetric"
            referencedColumns: ["campaignId", "createdAt"]
          },
          {
            foreignKeyName: "CampaignSummary_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      CampaignTemplates: {
        Row: {
          abTest: boolean | null
          advantageCampaignBudget: boolean | null
          advantagePlusCatalog: boolean | null
          bidStrategy: string | null
          buyingType: string | null
          campaignBudgetType: string | null
          campaignBudgetValue: number | null
          campaignObjective: string | null
          campaignStatus: string | null
          catalogId: string | null
          createdAt: string | null
          id: string
          isAdsetBudgetSharing: boolean | null
          name: string
          specialAdCategories: string[] | null
          spendCap: number | null
          tenantId: string
        }
        Insert: {
          abTest?: boolean | null
          advantageCampaignBudget?: boolean | null
          advantagePlusCatalog?: boolean | null
          bidStrategy?: string | null
          buyingType?: string | null
          campaignBudgetType?: string | null
          campaignBudgetValue?: number | null
          campaignObjective?: string | null
          campaignStatus?: string | null
          catalogId?: string | null
          createdAt?: string | null
          id?: string
          isAdsetBudgetSharing?: boolean | null
          name?: string
          specialAdCategories?: string[] | null
          spendCap?: number | null
          tenantId: string
        }
        Update: {
          abTest?: boolean | null
          advantageCampaignBudget?: boolean | null
          advantagePlusCatalog?: boolean | null
          bidStrategy?: string | null
          buyingType?: string | null
          campaignBudgetType?: string | null
          campaignBudgetValue?: number | null
          campaignObjective?: string | null
          campaignStatus?: string | null
          catalogId?: string | null
          createdAt?: string | null
          id?: string
          isAdsetBudgetSharing?: boolean | null
          name?: string
          specialAdCategories?: string[] | null
          spendCap?: number | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "CampaignTemplates_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      Client: {
        Row: {
          category: Database["public"]["Enums"]["ClientCategory"] | null
          createdAt: string
          docFileLink: string | null
          id: string
          platform: Database["public"]["Enums"]["Platform"]
          platformAccountId: string
          platformAccountName: string
          tenantId: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["ClientCategory"] | null
          createdAt?: string
          docFileLink?: string | null
          id: string
          platform: Database["public"]["Enums"]["Platform"]
          platformAccountId: string
          platformAccountName: string
          tenantId: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ClientCategory"] | null
          createdAt?: string
          docFileLink?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["Platform"]
          platformAccountId?: string
          platformAccountName?: string
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Client_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      ErrorLogs: {
        Row: {
          context: Json | null
          createdAt: string | null
          errorMessage: string
          errorType: string | null
          functionName: string
          id: string
          resolved: boolean | null
          severity: string | null
          tenantId: string | null
        }
        Insert: {
          context?: Json | null
          createdAt?: string | null
          errorMessage: string
          errorType?: string | null
          functionName: string
          id?: string
          resolved?: boolean | null
          severity?: string | null
          tenantId?: string | null
        }
        Update: {
          context?: Json | null
          createdAt?: string | null
          errorMessage?: string
          errorType?: string | null
          functionName?: string
          id?: string
          resolved?: boolean | null
          severity?: string | null
          tenantId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ErrorLogs_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      Invite: {
        Row: {
          accepted: boolean
          createdAt: string
          email: string
          id: string
          invitedBy: string
          name: string
          tenantId: string
        }
        Insert: {
          accepted?: boolean
          createdAt?: string
          email: string
          id: string
          invitedBy: string
          name: string
          tenantId: string
        }
        Update: {
          accepted?: boolean
          createdAt?: string
          email?: string
          id?: string
          invitedBy?: string
          name?: string
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Invite_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      MediaCache: {
        Row: {
          adAccountId: string | null
          cloudinaryUrl: string
          createdAt: string | null
          id: string
          mediaType: string | null
          metaMediaId: string | null
          tenantId: string
        }
        Insert: {
          adAccountId?: string | null
          cloudinaryUrl: string
          createdAt?: string | null
          id?: string
          mediaType?: string | null
          metaMediaId?: string | null
          tenantId: string
        }
        Update: {
          adAccountId?: string | null
          cloudinaryUrl?: string
          createdAt?: string | null
          id?: string
          mediaType?: string | null
          metaMediaId?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "MediaCache_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      OAuthState: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          platform: Database["public"]["Enums"]["Platform"]
          state: string
          tenantId: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id: string
          platform: Database["public"]["Enums"]["Platform"]
          state: string
          tenantId: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          platform?: Database["public"]["Enums"]["Platform"]
          state?: string
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "OAuthState_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      platformCredentials: {
        Row: {
          accessToken: string | null
          accessTokenExpiry: string | null
          apikey: string | null
          appId: string | null
          appSecret: string | null
          createdAt: string
          id: string
          platform: Database["public"]["Enums"]["Platform"]
          refreshToken: string | null
          refreshTokenExpiry: string | null
          tenantId: string
          updatedAt: string
        }
        Insert: {
          accessToken?: string | null
          accessTokenExpiry?: string | null
          apikey?: string | null
          appId?: string | null
          appSecret?: string | null
          createdAt?: string
          id: string
          platform: Database["public"]["Enums"]["Platform"]
          refreshToken?: string | null
          refreshTokenExpiry?: string | null
          tenantId: string
          updatedAt: string
        }
        Update: {
          accessToken?: string | null
          accessTokenExpiry?: string | null
          apikey?: string | null
          appId?: string | null
          appSecret?: string | null
          createdAt?: string
          id?: string
          platform?: Database["public"]["Enums"]["Platform"]
          refreshToken?: string | null
          refreshTokenExpiry?: string | null
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "platformCredentials_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      Tenant: {
        Row: {
          billingEmail: string
          createdAt: string
          deletedAt: string | null
          features: Json | null
          id: string
          lastActiveAt: string
          maxAdAccounts: number
          maxUsers: number
          plan: Database["public"]["Enums"]["TenantPlan"] | null
          slug: string
          status: Database["public"]["Enums"]["TenantStatus"] | null
          stripeCustomerId: string
          stripeSubscriptionId: string
          suspendedAt: string | null
          tenantName: string
          trialEndsAt: string
          updatedAt: string
        }
        Insert: {
          billingEmail: string
          createdAt?: string
          deletedAt?: string | null
          features?: Json | null
          id: string
          lastActiveAt: string
          maxAdAccounts?: number
          maxUsers?: number
          plan?: Database["public"]["Enums"]["TenantPlan"] | null
          slug: string
          status?: Database["public"]["Enums"]["TenantStatus"] | null
          stripeCustomerId: string
          stripeSubscriptionId: string
          suspendedAt?: string | null
          tenantName: string
          trialEndsAt: string
          updatedAt: string
        }
        Update: {
          billingEmail?: string
          createdAt?: string
          deletedAt?: string | null
          features?: Json | null
          id?: string
          lastActiveAt?: string
          maxAdAccounts?: number
          maxUsers?: number
          plan?: Database["public"]["Enums"]["TenantPlan"] | null
          slug?: string
          status?: Database["public"]["Enums"]["TenantStatus"] | null
          stripeCustomerId?: string
          stripeSubscriptionId?: string
          suspendedAt?: string | null
          tenantName?: string
          trialEndsAt?: string
          updatedAt?: string
        }
        Relationships: []
      }
      User: {
        Row: {
          createdAt: string
          email: string
          emailVerified: string | null
          id: string
          name: string
          supabaseUserId: string
          tenantId: string
          updatedAt: string
          userPhoto: string | null
          userType: Database["public"]["Enums"]["userType"]
        }
        Insert: {
          createdAt?: string
          email: string
          emailVerified?: string | null
          id: string
          name: string
          supabaseUserId: string
          tenantId: string
          updatedAt: string
          userPhoto?: string | null
          userType: Database["public"]["Enums"]["userType"]
        }
        Update: {
          createdAt?: string
          email?: string
          emailVerified?: string | null
          id?: string
          name?: string
          supabaseUserId?: string
          tenantId?: string
          updatedAt?: string
          userPhoto?: string | null
          userType?: Database["public"]["Enums"]["userType"]
        }
        Relationships: [
          {
            foreignKeyName: "User_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "Tenant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: never; Returns: string }
      is_tenant_owner: { Args: { check_tenant_id: string }; Returns: boolean }
    }
    Enums: {
      ClientCategory: "ECOMMERCE" | "LEADS" | "REACH"
      Platform: "facebook" | "tiktok" | "openai"
      SubscriptionStatus:
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "unpaid"
      SummaryStatus: "pending" | "in_progress" | "completed" | "failed"
      TenantPlan: "free" | "basic" | "pro"
      TenantStatus: "active" | "suspended" | "cancelled"
      userType: "owner" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ClientCategory: ["ECOMMERCE", "LEADS", "REACH"],
      Platform: ["facebook", "tiktok", "openai"],
      SubscriptionStatus: [
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "trialing",
        "unpaid",
      ],
      SummaryStatus: ["pending", "in_progress", "completed", "failed"],
      TenantPlan: ["free", "basic", "pro"],
      TenantStatus: ["active", "suspended", "cancelled"],
      userType: ["owner", "member"],
    },
  },
} as const
