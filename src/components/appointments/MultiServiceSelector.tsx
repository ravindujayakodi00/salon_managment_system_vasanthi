'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Service, ServiceCategory } from '@/lib/types';
import { Check, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface MultiServiceSelectorProps {
    services: Service[];
    selectedServiceIds: string[];
    onSelectionChange: (serviceIds: string[]) => void;
}

export default function MultiServiceSelector({
    services,
    selectedServiceIds,
    onSelectionChange
}: MultiServiceSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Set<ServiceCategory>>(new Set());
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<ServiceCategory | 'All'>('All');

    // Get unique categories from services
    const categories: (ServiceCategory | 'All')[] = ['All', ...Array.from(new Set(services.map(s => s.category)))];

    // Filter services by search query and category
    const filteredServices = services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.category.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = selectedCategoryFilter === 'All' || service.category === selectedCategoryFilter;

        return matchesSearch && matchesCategory;
    });

    // Group services by category
    const groupedServices = filteredServices.reduce((acc, service) => {
        if (!acc[service.category]) {
            acc[service.category] = [];
        }
        acc[service.category].push(service);
        return acc;
    }, {} as Record<ServiceCategory, Service[]>);

    const toggleService = (serviceId: string) => {
        if (selectedServiceIds.includes(serviceId)) {
            onSelectionChange(selectedServiceIds.filter(id => id !== serviceId));
        } else {
            onSelectionChange([...selectedServiceIds, serviceId]);
        }
    };

    const toggleCategory = (category: ServiceCategory) => {
        const newCollapsed = new Set(collapsedCategories);
        if (newCollapsed.has(category)) {
            newCollapsed.delete(category);
        } else {
            newCollapsed.add(category);
        }
        setCollapsedCategories(newCollapsed);
    };

    // Calculate totals
    const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Services ({selectedServiceIds.length} selected)
                </label>
                {selectedServiceIds.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Total: Rs {totalPrice.toLocaleString()} • {totalDuration} mins
                    </div>
                )}
            </div>

            {/* Search Filter */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600"
                />
            </div>

            {/* Category Filter Buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {categories.map((category) => {
                    const count = category === 'All'
                        ? filteredServices.length
                        : filteredServices.filter(s => s.category === category).length;

                    return (
                        <button
                            key={category}
                            type="button"
                            onClick={() => setSelectedCategoryFilter(category)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${selectedCategoryFilter === category
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            <span>{category}</span>
                            {count > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${selectedCategoryFilter === category
                                        ? 'bg-white/20 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                    }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {Object.entries(groupedServices).map(([category, categoryServices]) => {
                    const isCollapsed = collapsedCategories.has(category as ServiceCategory);
                    const selectedInCategory = categoryServices.filter(s => selectedServiceIds.includes(s.id)).length;

                    return (
                        <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            {/* Category Header */}
                            <button
                                type="button"
                                onClick={() => toggleCategory(category as ServiceCategory)}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {category}
                                    </h4>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        ({categoryServices.length} {categoryServices.length === 1 ? 'service' : 'services'})
                                    </span>
                                    {selectedInCategory > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium">
                                            {selectedInCategory} selected
                                        </span>
                                    )}
                                </div>
                                {isCollapsed ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                    <ChevronUp className="h-4 w-4 text-gray-500" />
                                )}
                            </button>

                            {/* Category Services */}
                            <AnimatePresence>
                                {!isCollapsed && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-2 space-y-2 bg-white dark:bg-gray-900">
                                            {categoryServices.map((service) => {
                                                const isSelected = selectedServiceIds.includes(service.id);
                                                return (
                                                    <motion.button
                                                        key={service.id}
                                                        type="button"
                                                        onClick={() => toggleService(service.id)}
                                                        whileHover={{ scale: 1.01 }}
                                                        whileTap={{ scale: 0.99 }}
                                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${isSelected
                                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-medium text-sm ${isSelected
                                                                        ? 'text-primary-700 dark:text-primary-300'
                                                                        : 'text-gray-900 dark:text-white'
                                                                        }`}>
                                                                        {service.name}
                                                                    </span>
                                                                    {service.gender && (
                                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                                            {service.gender}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                                                        Rs {service.price.toLocaleString()}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500 dark:text-gray-500">
                                                                        {service.duration} mins
                                                                    </span>
                                                                </div>
                                                                {service.description && (
                                                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-1">
                                                                        {service.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected
                                                                ? 'bg-primary-500 border-primary-500'
                                                                : 'border-gray-300 dark:border-gray-600'
                                                                }`}>
                                                                {isSelected && (
                                                                    <Check className="w-3 h-3 text-white" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {filteredServices.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No services found{searchQuery && ` matching "${searchQuery}"`}
                </p>
            )}

            {selectedServiceIds.length === 0 && filteredServices.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Please select at least one service to continue
                </p>
            )}
        </div>
    );
}
