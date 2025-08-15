// Centralized icon imports for bundle optimization
// This approach reduces bundle size by importing only needed icons
// and provides a single point of control for all icon usage

// Import specific icons instead of the entire lucide-react library
export {
  // Navigation and UI
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  Filter,
  ListFilter,
  Settings,
  MoreVertical,
  
  // Actions
  PlusCircle,
  Edit3,
  Edit,
  Trash2,
  Upload,
  Download,
  Copy,
  Share2,
  RotateCcw as Refresh,
  Save,
  Ban,
  ThumbsUp,
  ThumbsDown,
  
  // Status indicators
  CheckCircle,
  CheckSquare,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Info,
  Loader2,
  
  // Content types
  FileText,
  File,
  FileSpreadsheet,
  StickyNote,
  ReceiptText,
  CreditCard,
  
  // Business entities
  Users,
  User,
  UserCheck as UserCheckIcon,
  UserX,
  Building,
  Truck,
  Home,
  Plane,
  MapPin,
  Calendar,
  DollarSign,
  BedDouble,
  ClipboardList,
  CarFront,
  
  // Features
  Eye,
  EyeOff,
  Printer,
  Bell,
  BellOff,
  ShieldCheck,
  Shield,
  Lock,
  Unlock,
  Mail,
  Phone,
  
  // Charts and analytics
  BarChart2,
  TrendingUp,
  Activity,
  
  // Common UI elements
  Heart,
  Star,
  Bookmark,
  Tag,
  Flag,
  
} from 'lucide-react';

// Re-export commonly used icon types for consistency
export type IconComponent = React.ComponentType<{
  className?: string;
  size?: number | string;
}>;

// Icon size presets for consistent usage
export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

// Icon size presets for consistent usage across the app
// Use these in your components: <Icon size={ICON_SIZES.md} />
// 
// Example usage:
// import { Eye, ICON_SIZES } from '@/components/ui/icons';
// <Eye className="text-blue-500" size={ICON_SIZES.lg} />